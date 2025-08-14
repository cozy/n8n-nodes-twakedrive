import type { INodeExecutionData } from 'n8n-workflow';

export function createEzlog(items: INodeExecutionData[], itemIndex: number) {
	return function (name: string, value: any) {
		if (!items[itemIndex].json) items[itemIndex].json = {};
		items[itemIndex].json[name] = value;
	};
}
