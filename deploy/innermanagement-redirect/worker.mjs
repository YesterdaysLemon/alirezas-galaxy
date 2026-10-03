/** Approved owned alias; URL setters preserve path and query without open redirects. */
export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== 'innermanagement.alirezaafshan.com')
      return new Response('Not found', { status: 404 });
    url.protocol = 'https:';
    url.hostname = 'innermanagement.systems';
    url.port = '';
    return Response.redirect(url.href, 301);
  },
};
