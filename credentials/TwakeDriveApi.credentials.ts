import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TwakeDriveApi implements ICredentialType {
	name = 'twakeDriveApi';
	displayName = 'Twake Drive API';

	documentationUrl = 'https://your-docs-url';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: 'Bearer {{ $credentials.apiToken }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://example.com/',
			url: '',
		},
	};
}
