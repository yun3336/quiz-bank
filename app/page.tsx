import { HomePage } from "@/components/HomePage";
import { filterHomeVendors, type HomeQuery } from "@/lib/homeSearch";
import { SITE_HOME_URL } from "@/lib/site";
import { getTrivia, parseTriviaGuess, pickTrivia } from "@/lib/trivia";
import { tryParseVendor } from "@/lib/vendor";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<HomeQuery & { tid?: string; guess?: string; v?: string; skip?: string }>;
}) {
  const params = await searchParams;
  const homeQuery: HomeQuery = {
    tid: params.tid,
    guess: params.guess,
    v: params.v,
    skip: params.skip,
    search: params.search,
    q: params.q,
  };
  const filter = tryParseVendor(params.v) ?? "all";
  const poolVendor = filter === "all" ? undefined : filter;
  const guess = parseTriviaGuess(params.guess);
  const fromId = getTrivia(params.tid);
  const trivia = guess !== null && fromId ? fromId : pickTrivia(poolVendor, params.skip);
  const searchQuery = params.q?.trim() ?? "";

  return (
    <>
      {/*
        Next.js Metadata API strips the homepage trailing slash (pathname "/" → origin).
        A native <link> is hoisted into <head> and preserves the GSC inspection URL.
      */}
      <link rel="canonical" href={SITE_HOME_URL} />
      <HomePage
        trivia={trivia}
        guess={guess !== null && fromId ? guess : null}
        filter={filter}
        homeQuery={homeQuery}
        searchQuery={searchQuery}
        vendors={filterHomeVendors(searchQuery)}
      />
    </>
  );
}
