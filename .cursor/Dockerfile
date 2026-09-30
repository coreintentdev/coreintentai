FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      openssh-client \
      sudo \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://tailscale.com/install.sh | sh \
    && mkdir -p /var/run/tailscale

# Cloud agents run as ubuntu; tailscaled needs sudo for interface setup.
RUN echo 'ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/tailscaled, /usr/bin/tailscale' > /etc/sudoers.d/tailscale \
    && chmod 440 /etc/sudoers.d/tailscale

USER ubuntu
