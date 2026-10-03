# Inner Management launch alias

`innermanagement.alirezaafshan.com` returns HTTP 301 to
`https://innermanagement.systems`, preserving the request path and query.
The Worker performs no upstream requests and accepts only this exact hostname.
It uses the existing Cloudflare account without purchasing or upgrading a plan.

The script is deployed with `npx wrangler deploy --config
deploy/innermanagement-redirect/wrangler.jsonc`. Its custom-domain binding is
managed separately so an unattended Wrangler deploy cannot silently overwrite
an existing DNS record. Before attaching a hostname, preview its domain
changeset and require one addition with no conflicts, updates or removals;
apply with both `override_existing_origin` and
`override_existing_dns_record` false. Preserve other DNS records and bindings.

The approved production binding is the exact hostname above, with preview
URLs and workers.dev disabled. No Caddy or Inner Management changes are needed.
