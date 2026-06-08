

# Project Memory — EventSnap DEV
> 446 notes | Score threshold: >40

## Safety — Never Run Destructive Commands

> Dangerous commands are actively monitored.
> Critical/high risk commands trigger error notifications in real-time.

- **NEVER** run `rm -rf`, `del /s`, `rmdir`, `format`, or any command that deletes files/directories without EXPLICIT user approval.
- **NEVER** run `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, or any destructive database operation.
- **NEVER** run `git push --force`, `git reset --hard`, or any command that rewrites history.
- **NEVER** run `npm publish`, `docker rm`, `terraform destroy`, or any irreversible deployment/infrastructure command.
- **NEVER** pipe remote scripts to shell (`curl | bash`, `wget | sh`).
- **ALWAYS** ask the user before running commands that modify system state, install packages, or make network requests.
- When in doubt, **show the command first** and wait for approval.

**Stack:** Unknown stack

## Important Warnings

- **⚠️ GOTCHA: Added JWT tokens authentication — evolves the database schema to support new ...** — - > 404 notes | Score threshold: >40
+ > 407 notes | Score threshold: 
- **⚠️ GOTCHA: Added JWT tokens authentication** — - > 401 notes | Score threshold: >40
+ > 404 notes | Score threshold: 
- **⚠️ GOTCHA: Added JWT tokens authentication** — - > 397 notes | Score threshold: >40
+ > 401 notes | Score threshold: 
- **⚠️ GOTCHA: Added JWT tokens authentication** — - > 392 notes | Score threshold: >40
+ > 397 notes | Score threshold: 
- **⚠️ GOTCHA: Added JWT tokens authentication — evolves the database schema to support new ...** — - > 390 notes | Score threshold: >40
+ > 392 notes | Score threshold: 
- **⚠️ GOTCHA: Added JWT tokens authentication — evolves the database schema to support new ...** — - > 384 notes | Score threshold: >40
+ > 387 notes | Score threshold: 

## Project Standards

- what-changed in brainsync_auto.md — confirmed 3x
- Added JWT tokens authentication — confirmed 3x
- what-changed in brainsync_auto.md — confirmed 3x
- what-changed in brainsync_auto.md — confirmed 3x
- Added JWT tokens authentication — confirmed 3x
- what-changed in brainsync_auto.md — confirmed 3x
- what-changed in brainsync_auto.md — confirmed 3x
- Added JWT tokens authentication — confirmed 3x

## Known Fixes

- ❌ + - ❌ -     } catch (error) { → ✅ Fixed null crash in Apply — prevents null/undefined runtime crashe → ✅ Patched security issue Score — evolves the database schema to support new req...
- ❌ -     } catch (error) { → ✅ Fixed null crash in Apply — prevents null/undefined runtime crashes
- ❌ - - Patched security issue Error — prevents XSS injection attacks → ✅ Patched security issue Patched

## Learned Patterns

- Always: what-changed in brainsync_auto.md — confirmed 3x (seen 2x)
- Always: what-changed in brainsync_auto.md — confirmed 3x (seen 4x)
- Always: what-changed in brainsync_auto.md — confirmed 3x (seen 5x)
- Agent generates new migration for every change (squash related changes)
- Agent installs packages without checking if already installed

## Available Tools (ON-DEMAND only)
- `sys_core_01(q)` — Deep search when stuck
- `sys_core_05(query)` — Full-text lookup
> Context above IS your context. Do NOT call sys_core_14() at startup.
