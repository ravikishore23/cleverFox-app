export class MockProvider {
    async chat(input) {
        const lastUser = [...input.messages]
            .reverse()
            .find((m) => m.role === "user");
        return {
            outputText: `Mock reply: ${lastUser?.content ?? "(no user message)"}`,
            provider: "mock",
            model: input.model,
        };
    }
}
