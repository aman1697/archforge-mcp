# Troubleshooting

Find your symptom, then follow the fix. Problems are grouped by when they happen: installing, connecting, interviewing, generating, exporting.

**First, two commands that answer most questions**

* In a terminal: `node dist/index.js` — it should print `[archforge] v0.1.0 ready …` and then wait. Press `Ctrl+C` to stop. If it errors, the problem is installation or the path.
* In the chat: `Run archforge_config` — shows what your IDE supports and which model will write the documents. Add `with test:true` to check a configured provider.

---

## 1. Installing (Windows PowerShell)

| Symptom | Cause | Fix |
|---|---|---|
| `The token '&&' is not a valid statement separator` | Windows PowerShell 5 does not support `&&` | Run each command on its own line |
| `unzip` is not recognized | `unzip` is not a PowerShell command | `Expand-Archive .\archforge-mcp.zip -DestinationPath .` |
| `npm error ENOENT … package.json` | Terminal is in the wrong folder; the zip often extracts to `archforge-mcp\archforge-mcp` | Run `dir`; `cd` into the folder that contains `package.json`, `src` and `dist` |
| `running scripts is disabled on this system` | PowerShell execution policy blocks `npm.ps1` | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, or run `npm.cmd install` / `npm.cmd run build` |
| `node` is not recognized | Node.js missing or terminal opened before installing it | Install Node 18+ from nodejs.org and open a new terminal. A conda `(base)` prompt does not provide Node |
| `npm install` fails with network errors | Proxy or offline machine | Configure npm's proxy settings, or install on a machine with access and copy the folder including `node_modules` |
| Build errors after editing source | TypeScript error | Read the first error from `npm run build`; fix and rebuild |

## 2. Connecting the server to the IDE

| Symptom | Cause | Fix |
|---|---|---|
| Server not listed in `/mcp` (Claude Code) | Wrong file name or key | The file must be **`.mcp.json`** (leading dot) in the project folder, with top-level key **`mcpServers`**. Reload the window, start a new session, approve the server if prompted |
| `mcp.json` exists but nothing happens in Claude Code | `mcp.json` without the dot is not read by Claude Code | Rename it to `.mcp.json` |
| Config in `~/.copilot/mcp-config.json` has no effect | That file belongs to the GitHub Copilot **command-line tool** | Use `.vscode/mcp.json` for VS Code chat or `.mcp.json` for Claude Code |
| Server not in VS Code's tools list | Wrong key, not started, or not in Agent mode | `.vscode/mcp.json` with key **`servers`** and `"type": "stdio"`; click **Start** above the entry; set chat to **Agent**; open the tools picker |
| Status *failed* / *connection closed* | The command exits immediately | Run the same command in a terminal. Check: absolute path to `dist/index.js`; doubled backslashes in JSON (`C:\\path\\…`); Node ≥ 18; `npm run build` was done |
| Works in a terminal but not in the IDE | The IDE uses a different `node` or working folder | Use the full path to `node.exe` in `"command"`, e.g. `"C:\\Program Files\\nodejs\\node.exe"` |
| Tools are listed but calls need approval every time | Permission prompts | Choose the *always allow* option for archforge tools |
| Changed the code or config but nothing changed | The old server process is still running | Reconnect the server (`/mcp` in Claude Code) or reload the IDE window |
| Several MCP servers show *Needs Auth* | Unrelated cloud connectors (for example claude.ai integrations) | Ignore them — they are separate from Archforge |

## 3. Interview

| Symptom | Cause | Fix |
|---|---|---|
| "The popup form was declined" and questions appear as chat text | You declined/closed the form, or the client cannot show it | Answer in chat (this is fully supported). To bring forms back: `Run archforge_ask with mode elicit` |
| No popup appears at all | Client lacks elicitation, or the form opened without focus | Run `archforge_config` — if it says "not supported", chat questions are expected. Otherwise look for a notification or the chat panel |
| The chat model answered the questions itself | The model ignored the instruction | Say: "Stop. Show me the archforge questions and wait for my answers." Inferred values are labeled and still need your confirmation |
| A value is rejected | It is not one of the valid options or is out of range | The message lists valid options; answer again. Labels and keys are both accepted |
| The availability you need is not listed | Options are 99 / 99.5 / 99.9 / 99.95 / 99.99 | Choose the closest and state the exact target in the free-text fields; or edit the question in `src/questions/bank.ts` |
| Too many questions | Interview is thorough by design | Reply "use defaults" for any or all; every default is recorded as an assumption |
| "Interview is not finished" when generating | Some questions are unanswered | Finish with `archforge_ask`, or generate with `force:true` to use defaults |

## 4. Generating the documents

| Symptom | Cause | Fix |
|---|---|---|
| It seems slow or stuck | Each batch of 3–4 sections takes a minute or two; local models are slower | Wait; many tool calls scrolling by is normal. Check `archforge_status` — sections turn ✔ as they are saved. Press `Esc` to stop; progress is kept |
| It stopped after a few sections | The chat model ended its turn | Say: `Continue the archforge design for project <id>` |
| `Provider problem: environment variable … is not set` | The key variable is missing in the server's environment | `setx` the variable, **fully restart the IDE**, and reference it in the `env` block; or use host mode |
| `HTTP 401` / `403` from a provider | Wrong or expired key, or no access to the model | Check the key and the model name; run `archforge_config` with `test:true` |
| `Could not reach localhost:11434` (Ollama) | Ollama is not running | Start Ollama; `archforge_config` also lists the models it sees |
| `model … not pulled` | Ollama does not have that model | `ollama pull <model>` and use exactly that name |
| `timed out` | Large model on slow hardware, or an overloaded service | Use a smaller `generation.sectionsPerCall`, a faster model, or host mode |
| Sampling request rejected | The IDE asked you to approve a model request and it was declined | Approve it, or `archforge_config llmMode: host` |
| A section was "kept with warnings" | The model could not fix a validation issue within 2 retries | Run `archforge_generate_design` for that section with `sectionIds` and `feedback` naming the problem |
| Output is shallow or generic | Small model, or too little detail in the idea | Add specifics (users, workflows, constraints, tech) and regenerate; use a stronger model |
| Sections marked ⟳ stale | You changed an answer after they were written | `Regenerate stale sections for project <id>` or ignore if the change is minor |
| `No project with id …` | Wrong id or different `ARCHFORGE_HOME` | `Run archforge_status` to list project ids |

## 5. Diagrams and export

| Symptom | Cause | Fix |
|---|---|---|
| A diagram shows as raw text | Your Markdown previewer has no Mermaid support | Open `viewer.html` in a browser (needs internet for two CDN scripts) or use a Mermaid-aware previewer |
| A diagram shows a syntax error | The lint is heuristic and cannot catch everything | `Regenerate <section id> with feedback: fix the Mermaid syntax of diagram 2` — common causes are unquoted parentheses in labels and missing `end` |
| Files were not written where expected | The IDE has no open folder, or reports a different root | Open a folder in the IDE, or tell the chat model an absolute `outDir`. Without a workspace the files go to `~/.archforge/exports/<id>` |
| My edits to `hld.md` disappeared | Exports are regenerated from the stored project | Copy the files before hand-editing, or ask for revisions through the chat |
| Export says sections are missing | Not all sections were generated | Continue generation, then export again |

## 6. Where to look for logs

* The server writes status and fatal errors to **stderr** with the prefix `[archforge]`.
* Claude Code: `/mcp`, then select archforge. VS Code: **View → Output** and pick the MCP server entry. Other IDEs: their MCP or extension log panel.
* Project data: `~/.archforge/projects/<id>.json` (readable JSON; shows answers and section status).

## 7. Start over

| Goal | Do this |
|---|---|
| Restart one design | Start a new project with `archforge_start_project`; old ones stay in `archforge_status` |
| Delete one project | Delete `~/.archforge/projects/<id>.json` |
| Reset settings | Delete `~/.archforge/config.json` |
| Remove all state | Delete the `~/.archforge` folder |
| Reinstall | Delete `node_modules` and `dist`, then `npm install` and `npm run build` |

If none of this helps, collect: the output of `node dist/index.js`, the output of `archforge_config`, your IDE name and version, and your operating system — that is enough to diagnose almost any problem.
