---
description: How to connect to the production VPS server (api.dosiqai.com) to diagnose and fix backend or database issues
---

When the USER asks to diagnose server issues, check the backend logs, or modify the production database, follow these steps to connect to the VPS via SSH.

### 1. SSH Connection Credentials
The server is accessible using the USER's local SSH keys. 
- **Host**: `api.dosiqai.com`
- **User**: `root`
- **Identity File**: `~/.ssh/vps`

You can run remote commands safely using your `run_command` tool.
Example: `ssh -i ~/.ssh/vps root@api.dosiqai.com 'systemctl status api-dosiqai.service'`

### 2. Service Information
The server runs two primary services:
- **Node.js Express API**: Located at `/home/ubuntu/api-dosiqai`. The systemd service managing it is `api-dosiqai.service`. You can view logs by using journalctl: `ssh -i ~/.ssh/vps root@api.dosiqai.com 'journalctl -u api-dosiqai.service -n 100 --no-pager'`
- **PostgreSQL Database**: Running natively as `postgresql@17-main.service` on the same host. You can run SQL queries by passing them directly to the `postgres` user.
  Example: `ssh -i ~/.ssh/vps root@api.dosiqai.com 'sudo -u postgres psql -d postgres -c "SELECT * FROM family_members LIMIT 5;"'`

### 3. Workflow for Diagnosing Issues
1. Always start by checking the API logs using `journalctl -u api-dosiqai.service -n 50 --no-pager`.
2. Ensure both `api-dosiqai.service` and `postgresql@17-main.service` are active and running.
3. If an error is happening at the database level (like an RLS policy violation), construct the SQL fix locally, verify it, and apply it via the `psql` command over SSH.
4. If editing the Node.js API code in `/home/ubuntu/api-dosiqai`, remember to restart the service afterward: `ssh -i ~/.ssh/vps root@api.dosiqai.com 'systemctl restart api-dosiqai.service'`
