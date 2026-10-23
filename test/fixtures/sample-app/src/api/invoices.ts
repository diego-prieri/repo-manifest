export type InvoiceStatus = 'paid' | 'pending';
export enum Currency { ARS = 'ARS', USD = 'USD' }
export const BASE_URL = '/api/invoices';
export async function getInvoices(query: string) { return []; }
export class InvoiceClient {}
