# Deception Weaver

Create an AI sandbox environment for a cyber use case: a dynamic, high-interaction deception honeynet.

The Industry Blind Spot: Traditional honeypots (like Cowrie or Dionaea) rely on static, hardcoded Linux command emulations. Any sophisticated attacker or automated scanner detects them within 2 commands because commands like iptables, systemctl, or complex bash pipelines return syntax errors or fake generic responses.

How It Works:
- A container/sandbox environment where an autonomous agent acts as a dynamic deception persona (e.g., an internal Kubernetes bastion, a financial database host, or an internal identity server).
- When real incoming connection attempts (SSH/HTTP/API) enter the sandbox, the agent synthesizes realistic, context-coherent responses to attacker commands on the fly, while the underlying sandbox records every keystroke, raw socket interaction, and file dropped.
- The sandbox performs automated defensive forensics on what the attacker tried to do, generating real-time SIEM alerts and IOCs (Indicators of Compromise) without exposing any real enterprise infrastructure.
- Dynamic, generative high-interaction deception that cannot be fingerprinted like static honeypots.

App should be easy to use with a clean, aesthetic UI, and ready to connect real data and telemetry rather than static mock placeholders.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8b5a1e44-2656-4f45-b077-49eddd48164f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
