const json = (body, status) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

export function adaptCloudflarePagesHandlers(handlers, options = {}) {
  return async function netlifyHandler(request, context = {}) {
    const method = String(request?.method || 'GET').toUpperCase();
    const handler = handlers[method];
    if (typeof handler !== 'function') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const env = typeof options.createEnv === 'function'
      ? await options.createEnv({ request, context, processEnv: process.env })
      : process.env;

    return handler({
      request,
      env,
      params: context.params || {},
      netlifyContext: context
    });
  };
}
