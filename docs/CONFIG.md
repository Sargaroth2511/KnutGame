# Configuration & Secrets

This project uses a layered configuration strategy for a smooth developer experience and safe secret handling.

## Sources & Precedence (high → low)
1. Environment variables (e.g., `OpenAI__ApiKey`)
2. `appsettings.{Environment}.Local.json` (ignored by git)
3. `appsettings.Local.json` (ignored by git)
4. User-secrets (always loaded)
5. `appsettings.{Environment}.json`
6. `appsettings.json`

Program.cs wires these sources so you can choose the most convenient method.

## OpenAI Options
Keys:
- `OpenAI.Enabled` (bool)
- `OpenAI.ApiKey` (string)
- `OpenAI.Organization` (string, optional)
- `OpenAI.Model` (e.g., `gpt-4o-mini`)
- `OpenAI.SystemPromptPath` (e.g., `prompts/ai_system_prompt_start.md`)
- `OpenAI.Temperature` (double)
- `OpenAI.MaxTokens` (int)

### Recommended for Dev: User-Secrets
- Enable and set secrets in the server project:
  - `cd src/KnutGame.Server`
  - `dotnet user-secrets set "OpenAI:Enabled" "true"`
  - `dotnet user-secrets set "OpenAI:ApiKey" "sk-your-real-key"`
  - Optionally: `dotnet user-secrets set "OpenAI:Organization" "org_xxxxx"`

### Alternative: Local JSON (ignored by git)
- Create `src/KnutGame.Server/appsettings.Local.json`:
```
{
  "OpenAI": {
    "Enabled": true,
    "ApiKey": "sk-your-real-key",
    "Model": "gpt-4o-mini",
    "SystemPromptPath": "prompts/ai_system_prompt_start.md",
    "Temperature": 0.6,
    "MaxTokens": 200
  }
}
```

### Environment Variables (CI/Prod)
- `OpenAI__Enabled=true`
- `OpenAI__ApiKey=sk-your-real-key`
- Optional: `OpenAI__Organization=org_xxxxx`

### Placeholders
- `${VARNAME}` placeholders are expanded in OpenAI options; if `ApiKey` remains a placeholder, the app also looks at `OPENAI_API_KEY`.

## Prompt File
- Default: `prompts/ai_system_prompt_start.md`
- Editable without code changes. The service reads the file each request.

