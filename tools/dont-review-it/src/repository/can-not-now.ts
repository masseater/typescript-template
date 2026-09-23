#!/usr/bin/env node
import { appendFileSync } from "node:fs";

import {
  pendingIssues,
  trustedComments,
  type CommentRecord,
  type IssueRecord,
  type PullRecord,
} from "./can-not-now-scope.ts";

const API_ORIGIN = "https://api.github.com";
const PAGE_SIZE = 100;

const required = (name: "GH_TOKEN" | "GITHUB_OUTPUT" | "GITHUB_REPOSITORY"): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
};

const token = required("GH_TOKEN");
const repository = required("GITHUB_REPOSITORY");

const pageOf = async <Item>(path: string, page: number): Promise<readonly Item[]> => {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${API_ORIGIN}/repos/${repository}${path}${separator}per_page=${PAGE_SIZE}&page=${page}`;
  const answered = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!answered.ok) {
    throw new Error(`Do not read past a GitHub API failure: ${answered.status} on ${url}.`);
  }
  return (await answered.json()) as readonly Item[];
};

const everyPage = async <Item>(path: string, page = 1): Promise<readonly Item[]> => {
  const items = await pageOf<Item>(path, page);
  return items.length < PAGE_SIZE ? items : [...items, ...(await everyPage<Item>(path, page + 1))];
};

const [issues, openPulls] = await Promise.all([
  everyPage<IssueRecord>("/issues?labels=can-not-now&state=open"),
  everyPage<PullRecord>("/pulls?state=open"),
]);

const tasks = await Promise.all(
  pendingIssues({ issues, openPulls, repository }).map(async (issue) => ({
    body: issue.body ?? "",
    comments: trustedComments(await everyPage<CommentRecord>(`/issues/${issue.number}/comments`)),
    number: issue.number,
    title: issue.title,
  })),
);

appendFileSync(
  required("GITHUB_OUTPUT"),
  `count=${tasks.length}\nissues=${JSON.stringify(tasks)}\n`,
);
