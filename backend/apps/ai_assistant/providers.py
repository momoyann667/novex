from dataclasses import dataclass


@dataclass(frozen=True)
class AIProviderResult:
    content: str
    provider: str = "local"
    model: str = "novex-local-tools"
    prompt_tokens: int = 0
    completion_tokens: int = 0


class AIProvider:
    def chat(self, *, prompt: str, context: dict, tool_results: list[dict]) -> AIProviderResult:
        raise NotImplementedError


class LocalToolProvider(AIProvider):
    def chat(self, *, prompt: str, context: dict, tool_results: list[dict]) -> AIProviderResult:
        if not tool_results:
            return AIProviderResult(
                content="Je ne trouve pas cette information dans les donnees disponibles de votre association."
            )

        lines = [f"Voici ce que je trouve pour {context['workspace']['name']} :"]
        for result in tool_results:
            if result.get("denied"):
                lines.append(f"- {result['label']} : acces non autorise.")
                continue
            lines.append(f"- {result['label']} : {result['summary']}")
        lines.append("Les valeurs viennent des modules NOVEX autorises pour ce workspace.")
        return AIProviderResult(content="\n".join(lines))


def get_ai_provider() -> AIProvider:
    return LocalToolProvider()
