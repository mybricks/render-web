interface FetchAIParams {
  body: {
    messages: {
      role: "system" | "user";
      content: string;
    }[];
    model: string;
  };
  url: string;
}

const fetchAI = async (params: FetchAIParams) => {
  const { body, url } = params;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let chunk = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunk += decoder.decode(value, { stream: true });
  }

  return chunk;
};

export default fetchAI;
