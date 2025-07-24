import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TwakeDriveApi implements ICredentialType {
	name = 'twakeDriveApi';
	displayName = 'Twake Drive API';

	documentationUrl = 'https://github.com/cozy/cozy-stack/tree/master/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'Instance URL',
			name: 'instanceUrl',
			type: 'string',
			default: '',
			placeholder: 'https://yourinstance.mycozy.cloud or https://yourinstance.twake.linagora.com',
			description: 'Base URL of the Twake instance',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
			description: 'API token for authorization',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.instanceUrl}}',
			url: '/files/io.cozy.files.root-dir',
		},
	};
}
