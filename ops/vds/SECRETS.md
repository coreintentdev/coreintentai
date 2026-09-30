# VDS secrets — one-time Cursor environment setup

Do **not** paste these in chat. Add in [Cursor environment dashboard](https://cursor.com/dashboard/cloud-agents/environments).

## Required

| Secret | How to get it |
|--------|----------------|
| `ZYNTHIO_DC_SSH_KEY` | Contents of Mac `~/.ssh/zynthio_dc` (private key) |
| `HEADSCALE_PREAUTH_KEY` | Create on Headscale admin for user/namespace `zynthio` |

Mesh login server is **hardcoded default**: `https://headscale.kamals.pro` (same as Mac Tailscale menu: *zynthio @ headscale.kamals.pro*).

### Generate Headscale preauth key (on VDS or Headscale admin host)

```bash
headscale preauthkeys create --user zynthio --reusable --expiration 720h
```

Copy the key value into Cursor secret `HEADSCALE_PREAUTH_KEY`. Reusable + 30-day expiry is enough for Cloud Agent pods.

## Verify (fresh cloud agent after snapshot rebuild)

```bash
ops/vds/vds.sh status    # exit 0
ops/vds/vds.sh deploy kelvin
ops/vds/vds.sh prove kelvin
```
