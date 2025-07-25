# n8n-nodes-twakedrive

This is an n8n community node. It lets you use Twake Drive in your n8n workflows.

Twake Drive is an open source file sharing and storage platform focused on privacy and security. It’s built for efficient team collaboration with shared spaces, real-time editing, and seamless file organization.

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

- List files and folders
- Upload files
- Copy files
- Create file from text
- Delete files
- Update files
- Move files

_Folder and Shared Drive operations are planned for future updates._

## Credentials

This node uses a custom credential type to connect to your Twake instance via the Cozy Stack. You’ll need :

- A Twake instance installed locally
- A permissions token generated from your local stack

> **Note:**
> Currently, token generation is only possible via a locally installed Cozy Stack using this script :

```bash
#!/bin/bash

# === Config ===
INSTANCE_URL="YOUR_INSTANCE_URL" # https://yourinstance.mycozy.cloud or https://yourinstance.twake.linagora.com
INSTANCE_NAME="YOUR_INSTANCE_NAME" # yourinstance.mycozy.cloud or yourinstance.twake.linagora.com
APP_NAME="n8n" # Mandatory

# === Get first token via Cozy CLI ===
FIRST_TOKEN=$(cozy-stack instances token-cli "$INSTANCE_NAME" io.cozy.files )

if [ -z "$FIRST_TOKEN" ]; then
  echo "❌ Impossible to fetch first token, verify your cozy-stack installation"
  exit 1
fi

# === Do the POST request to /permissions ===
RESPONSE=$(curl -s -X POST "$INSTANCE_URL/permissions?codes=$APP_NAME" \
  -H "Authorization: Bearer $FIRST_TOKEN" \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "io.cozy.permissions",
      "attributes": {
        "permissions": {
          "io.cozy.files": {
            "description": "Access your files",
            "type": "io.cozy.files",
            "verbs": ["ALL"]
          }
        }
      }
    }
  }')

# === Extract the permissions token ===
PERMISSIONS_TOKEN=$(echo "$RESPONSE" | jq -r ".data.attributes.codes[\"$APP_NAME\"]")

if [ "$PERMISSIONS_TOKEN" == "null" ] || [ -z "$PERMISSIONS_TOKEN" ]; then
  echo "❌ Final token not found"
  exit 1
fi

# === Output final token ===
echo "$PERMISSIONS_TOKEN"
```

This will generate the token you will need to copy into the node's credentials along your instanceURL to execute your workflow.

_Token generation via your Twake Drive instance's settings is planned in future versions._

## Compatibility

Tested with:

- Cozy Stack v1.6.39
- n8n v1.0+

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

This is a community node. If you encounter issues or have feature requests, feel free to open an issue or PR on the [GitHub repository](https://github.com/KillianCourvoisier/n8n-nodes-twakedrive).

## Version history

### 1.0.0 - First release 🎉

- Connect via a locally generated token
- Files operations (as listed above)
