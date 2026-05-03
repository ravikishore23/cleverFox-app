import * as cheerio from "cheerio";

export type SearchResult = {
  title: string;
  link: string;
  snippet: string;
};

export async function performWebSearch(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`Search request failed with status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, element) => {
      const title = $(element).find(".result__title .result__a").text().trim();
      const link = $(element).find(".result__url").attr("href")?.trim() || $(element).find(".result__a").attr("href")?.trim() || "";
      const snippet = $(element).find(".result__snippet").text().trim();

      // DuckDuckGo sometimes prepends redirect links
      let cleanLink = link;
      if (cleanLink.startsWith("//duckduckgo.com/l/?uddg=")) {
         const param = cleanLink.split("uddg=")[1];
         if (param) cleanLink = decodeURIComponent(param.split("&")[0]);
      }

      if (title && snippet) {
        results.push({ title, link: cleanLink, snippet });
      }
    });

    return results.slice(0, 5); // Return top 5 results
  } catch (error) {
    console.error("Web search failed:", error);
    return [];
  }
}
