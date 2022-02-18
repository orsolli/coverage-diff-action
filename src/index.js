const { readFile } = require("fs/promises");
const { existsSync } = require("fs");
const core = require("@actions/core");
const github = require("@actions/github");

const { computeDiff } = require("./diff");
const { addComment, deleteExistingComments } = require("./comment");

const { context } = github;

async function run() {
  const githubToken = core.getInput("github-token");
  const baseSummaryFilename = core.getInput("base-summary-filename");
  const coverageFilename = core.getInput("coverage-filename");

  const octokit = github.getOctokit(githubToken);

  const issue_number = context?.payload?.pull_request?.number;
  const allowedToFail = core.getBooleanInput("allowed-to-fail");

  if (!existsSync(baseSummaryFilename)) {
    core.info(`No base json-summary found at ${coverageFilename}`);
    return;
  }
  if (!existsSync(coverageFilename)) {
    core.info(`No coverage json-summary found at ${coverageFilename}`);
    return;
  }
  const base = JSON.parse(await readFile(baseSummaryFilename, "utf8")) || {};
  const head = JSON.parse(await readFile(coverageFilename, "utf8")) || {};

  const diff = computeDiff(base, head, { allowedToFail });

  if (issue_number) {
    await deleteExistingComments(octokit, context.repo, issue_number);

    core.info("Add a comment with the diff coverage report");
    await addComment(octokit, context.repo, issue_number, diff.markdown);
  } else {
    core.info(diff.results);
  }

  if (!allowedToFail && diff.regression) {
    throw new Error("Total coverage is lower than the default branch");
  }
}

try {
  run();
} catch (error) {
  core.setFailed(error.message);
}
