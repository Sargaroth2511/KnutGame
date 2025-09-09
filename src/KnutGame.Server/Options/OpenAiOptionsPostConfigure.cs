using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace KnutGame.Options;

public class OpenAiOptionsPostConfigure : IPostConfigureOptions<OpenAiOptions>
{
    private static readonly Regex Placeholder = new Regex(@"\$\{(?<name>[A-Za-z_][A-Za-z0-9_]*)\}", RegexOptions.Compiled);

    public void PostConfigure(string? name, OpenAiOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.ApiKey))
        {
            options.ApiKey = ExpandEnv(options.ApiKey);
        }
        // Fallback: allow reading OPENAI_API_KEY directly if ApiKey is empty or still a placeholder
        if (string.IsNullOrWhiteSpace(options.ApiKey) || IsPlaceholder(options.ApiKey))
        {
            var envKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
            if (!string.IsNullOrWhiteSpace(envKey))
            {
                options.ApiKey = envKey;
            }
        }
        if (!string.IsNullOrWhiteSpace(options.Organization))
        {
            options.Organization = ExpandEnv(options.Organization!);
        }
        if (!string.IsNullOrWhiteSpace(options.SystemPromptPath))
        {
            options.SystemPromptPath = ExpandEnv(options.SystemPromptPath);
        }
    }

    private static string ExpandEnv(string value)
    {
        return Placeholder.Replace(value, m =>
        {
            var varName = m.Groups["name"].Value;
            var env = Environment.GetEnvironmentVariable(varName);
            return env ?? m.Value; // leave placeholder if missing
        });
    }

    private static bool IsPlaceholder(string value)
    {
        var m = Placeholder.Match(value);
        return m.Success && m.Value.Length == value.Length;
    }
}
