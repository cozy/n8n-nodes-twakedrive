# n8n-nodes-twakedrive

This is an n8n community node. It lets you use Twake Drive in your n8n workflows.

[Twake Drive](https://twake-drive.com/) is an open source file sharing and storage platform focused on privacy and security. It’s built for efficient team collaboration with shared spaces, real-time editing, and seamless file organization. The Twake Drive app relies ont the [Cozy stack API](https://github.com/cozy/cozy-stack/tree/master/docs) for permissions management and files operations.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Resources](#resources)  
[Version history](#version-history)

## Installation

- Go to **Settings > Community Nodes**
- Click **Install a community node**
- Enter `n8n-nodes-twakedrive` in the "Enter npm package name" field
- Acknowledge the risk: check **"I understand the risks..."**
- Click **Install**

Once installed, you can find it like any other node. Just search for **"Twake Drive"** in the node panel.

Or follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

List of all available operations in this node.

### Files operations

- List files
  - From specified folder
  - All files on the instance
- Upload files
- Copy files
- Create file from text
- Delete files
- Update files
- Move files

### Folders operations

- Create Folder
- Delete Folder
- Move Folder
- Rename Folder

### Shares operations

- Delete Share (by Permissions ID)
  - Dynamic dropdown to select a permission ID
  - Dynamic dropdown depending on the selected ID to select a specific label(s) to revoke share link from.
- Share by Link (File or Folder)
  - With multi-label handling, expiration possibility and password protection.

_Different improvements (like dynamic lists when relevant on files and folders operations or Triggers operations) are planned for future updates._

## Credentials

This node uses a custom credential type to connect to your Twake instance via the Cozy Stack. You’ll need :

- A Twake instance installed locally
- An app token generated from your local stack

> **Note:**
> Currently, token generation is only possible via a locally installed Cozy Stack using this script :

```bash
#!/bin/bash

# === Config ===
INSTANCE_URL="YOUR_INSTANCE_URL" # https://yourinstance.mycozy.cloud or https://yourinstance.twake.linagora.com
INSTANCE_NAME="YOUR_INSTANCE_NAME" # yourinstance.mycozy.cloud or yourinstance.twake.linagora.com
APP_NAME="n8n" # mandatory to register the client
REDIRECT_URI="http://localhost/blank" # required to register the client
SCOPES=(io.cozy.files) # full R/W on files
EXPIRE="" # optionnal: ex "30d" or "1h" for --expire

# === 1) Register OAuth client (return client_id) ===
CLIENT_JSON=$(cozy-stack instances client-oauth "$INSTANCE_NAME" "$REDIRECT_URI" "$APP_NAME" "$APP_NAME" --json 2>/dev/null || true)
if [ -n "${CLIENT_JSON}" ] && [ "${CLIENT_JSON}" != "null" ]; then
  CLIENT_ID=$(echo "$CLIENT_JSON" | jq -r '.client_id')
else
  # if already register : find it by software_id = APP_NAME
  CLIENT_ID=$(cozy-stack instances find-oauth-client "$INSTANCE_NAME" "$APP_NAME" 2>/dev/null | awk '/client_id/ {print $2}')
fi

if [ -z "${CLIENT_ID:-}" ] || [ "$CLIENT_ID" = "null" ]; then
  echo "❌ Impossible de récupérer client_id (enregistrement client OAuth)."
  exit 1
fi

# === 2) Generate app-token ===
if [ -n "$EXPIRE" ]; then
  ACCESS_TOKEN=$(cozy-stack instances token-oauth "$INSTANCE_NAME" "$CLIENT_ID" "${SCOPES[@]}" --expire "$EXPIRE")
else
  ACCESS_TOKEN=$(cozy-stack instances token-oauth "$INSTANCE_NAME" "$CLIENT_ID" "${SCOPES[@]}")
fi

if [ -z "${ACCESS_TOKEN:-}" ]; then
  echo "❌ Impossible de générer l'access token OAuth."
  exit 1
fi

echo "$ACCESS_TOKEN"
```

This will generate the token you will need to copy into the node's credentials along your instanceURL to execute your workflow.

_Token generation via your Twake Drive instance's settings is planned in future versions._

## Compatibility

Tested with:

- Cozy Stack v1.6.39
- n8n v1.0+

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

This is a community node. If you encounter issues or have feature requests, feel free to open an issue or PR on the [GitHub repository](https://github.com/cozy/n8n-nodes-twakedrive).

## Version history

### 1.1.1

- Transfer repo ownership to [Cozy](https://github.com/cozy/) Github organisation

### 1.1.0

- Using OAuth to get an app token instead of an admin token
- Folders operations (as listed above)
- Shares operations (as listed above)
- Add "byDirectory" option on `listFiles` operation
- Move `ezlog` (Little function to save an item during execution) in `/utils` folder for clarity
- Split operations in ressource categories in the n8n UI

### 1.0.0 - First release 🎉

- Connect via a locally generated token
- Files operations (as listed above)

## Useful links

- [Twake Drive website](https://twake-drive.com/)
- [Twake Drive on GitHub](https://github.com/cozy/cozy-drive)
- [Cozy Stack documentation](https://docs.cozy.io/en/cozy-stack/)
- [Cozy stack on Github](https://github.com/cozy/cozy-stack/)
- [Twake Drive node on GitHub](https://github.com/cozy/n8n-nodes-twakedrive)
