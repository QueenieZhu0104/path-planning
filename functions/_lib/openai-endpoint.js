const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_OPENAI_MODEL = 'gpt-6-luna';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';

function responsesUrl(baseUrl) {
  const base = String(baseUrl).trim().replace(/\/+$/, '');
  return /\/v1$/i.test(base) ? `${base}/responses` : `${base}/v1/responses`;
}

function deepSeekResponsesUrl(baseUrl) {
  const base = String(baseUrl).trim().replace(/\/+$/, '');
  return `${base}/responses`;
}

export function openAIResponsesUrl(env = {}) {
  return responsesUrl(env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL);
}

export function responsesProvider(env = {}, { consultant = false } = {}) {
  if (env.DEEPSEEK_API_KEY) {
    return {
      name: 'deepseek',
      apiKey: String(env.DEEPSEEK_API_KEY).trim(),
      url: deepSeekResponsesUrl(env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL),
      model: String((consultant && env.DEEPSEEK_CONSULTANT_MODEL) || env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL)
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      name: 'openai',
      apiKey: String(env.OPENAI_API_KEY).trim(),
      url: openAIResponsesUrl(env),
      model: String((consultant && env.OPENAI_CONSULTANT_MODEL) || env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL)
    };
  }
  return null;
}
