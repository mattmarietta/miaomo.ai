import {RecursiveCharacterTextSplitter} from "@langchain/textsplitters";

export async function chunkText(text: string) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1500,
    chunkOverlap: 200,
  });

  const docs = await splitter.createDocuments([text]);
  return docs.map((d, i) => ({
    chunkIndex: i,
    chunkText: d.pageContent,
  }));
}
