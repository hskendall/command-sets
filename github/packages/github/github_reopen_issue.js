// jshint esversion: 9

/**
 * @description Reopen a GitHub issue.
 * @param {ParamsType} params list of command parameters
 * @param {?string} commandText text message
 * @param {!object} [secrets = {}] list of secrets
 * @return {Promise<SlackBodyType>} Response body
 */
async function _command(params, commandText, secrets = {}) {
  let {github_token: githubToken, github_repos: defaultRepo} = secrets;
  if (!githubToken) {
    return {
      response_type: 'ephemeral',
      text:
        'Missing GitHub Personal Access Token! Create a secret named `github_token` with your personal access token.'
    };
  }

  // Extract the first repository.
  defaultRepo = defaultRepo.split(',').map(repo => repo.trim())[0];

  const result = [];
  const {issueNumber} = params;
  const repo = params.repo === false ? defaultRepo : params.repo;
  if (!repo && !defaultRepo) {
    return {
      response_type: 'ephemeral',
      text:
        'Either pass a repo name or create a secret named `github_default_repo` to avoid passing the repository.'
    };
  }

  try {
    const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}`;
    const axios = require('axios');
    const {data} = await axios({
      method: 'PATCH',
      url: url,
      data: {state: 'open'},
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Matches html tags
    const html = new RegExp(/<.*>.*<\/.*>/);
    const body = html.test(data.body)
      ? `_couldn't render body of issue_`
      : data.body
          // Convert markdown links to slack format.
          .replace(/!*\[(.*)\]\((.*)\)/g, '<$2|$1>')
          // Covert Issues mentions to links
          .replace(/#(\d+)/g, `<https://github.com/${repo}/issues/$1|#$1>`)
          // Replace markdown headings with slack bold
          .replace(/#+\s(.+)(?:\R(?!#(?!#)).*)*/g, '*$1*');

    result.push({
      color: 'good',
      title: data.title,
      text: body,
      title_link: data.html_url,
      pretext: `Issue <${data.html_url}|#${data.number}> of ${repo} has been reopened.`
    });
  } catch (error) {
    result.push({
      color: 'danger',
      text: `Error: ${error.response.status} ${error.response.data.message}`
    });
  }

  return {
    response_type: 'in_channel',
    attachments: result
  };
}

/**
 * @typedef {object} SlackBodyType
 * @property {string} text
 * @property {'in_channel'|'ephemeral'} [response_type]
 */

const main = async args => ({
  body: await _command(
    args.params,
    args.commandText,
    args.__secrets || {}
  ).catch(error => ({
    response_type: 'ephemeral',
    text: `Error: ${error.message}`
  }))
});
module.exports = main;
