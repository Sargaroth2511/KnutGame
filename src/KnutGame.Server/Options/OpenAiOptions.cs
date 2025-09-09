namespace KnutGame.Options;

public class OpenAiOptions
{
    public bool Enabled { get; set; } = false;
    public string? ApiKey { get; set; }
    public string? Organization { get; set; }
    public string Model { get; set; } = "gpt-4o-mini";
    public string SystemPromptPath { get; set; } = "prompts/ai_system_prompt_start.md";
    public string SystemPromptPathGameover { get; set; } = "prompts/ai_system_prompt_gameover.md";
    public double Temperature { get; set; } = 0.8;
    public int MaxTokens { get; set; } = 200;
}
