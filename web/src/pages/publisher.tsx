import { RecipesPage } from "./recipes";

export function PublisherPage({ publisher }: { publisher: string }) {
  return <RecipesPage fixedPublisher={publisher} />;
}
