import { getOctokit, context } from "@actions/github";
import { getCommentMarker } from "./comment-builder.js";

export async function postOrUpdateComment(
  token: string,
  body: string,
): Promise<void> {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;
  const issueNumber = context.payload.pull_request?.number;

  if (!issueNumber) {
    throw new Error("This action only works on pull_request events");
  }

  const marker = getCommentMarker();

  // Find existing comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const existing = comments.find((c) => c.body?.includes(marker));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

export async function getPrChangedFiles(
  token: string,
): Promise<string[]> {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;
  const pullNumber = context.payload.pull_request?.number;

  if (!pullNumber) return [];

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return files.map((f) => f.filename);
}
