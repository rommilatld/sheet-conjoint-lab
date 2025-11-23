// Temporary in-memory storage for demo purposes
// In production, this would be replaced with actual Google Sheets integration

const attributesStore = new Map<string, any>();

export function saveAttributes(sheetId: string, attributes: any[]) {
  attributesStore.set(sheetId, attributes);
  console.log(`Saved ${attributes.length} attributes for sheet ${sheetId}`);
}

export function getAttributes(sheetId: string): any[] {
  const attributes = attributesStore.get(sheetId) || [];
  console.log(`Retrieved ${attributes.length} attributes for sheet ${sheetId}`);
  return attributes;
}
