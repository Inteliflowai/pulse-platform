export class JellyfinError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'JellyfinError';
  }
}

export class JellyfinClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-Emby-Token': this.apiKey,
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new JellyfinError(res.status, `Jellyfin ${options.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return null;
  }

  async getSystemInfo(): Promise<any> {
    return this.request('/System/Info');
  }

  async createLibrary(name: string, paths: string[]): Promise<{ Id: string }> {
    const body = {
      Name: name,
      CollectionType: 'movies',
      LibraryOptions: {
        PathInfos: paths.map((p) => ({ Path: p })),
        EnableRealtimeMonitor: true,
      },
    };
    return this.request('/Library/VirtualFolders', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getLibraries(): Promise<any[]> {
    const data = await this.request('/Library/VirtualFolders');
    return Array.isArray(data) ? data : [];
  }

  async refreshLibrary(libraryId: string): Promise<void> {
    await this.request(`/Items/${libraryId}/Refresh`, { method: 'POST' });
  }

  async getItemById(itemId: string): Promise<any> {
    return this.request(`/Items/${itemId}?Fields=Path,MediaSources`);
  }

  async getItemsByPath(path: string): Promise<any[]> {
    const data = await this.request(`/Items?Recursive=true&Fields=Path&SearchTerm=${encodeURIComponent(path)}`);
    return data?.Items ?? [];
  }

  async getAllItems(): Promise<any[]> {
    const data = await this.request('/Items?Recursive=true&Fields=Path,MediaSources&IncludeItemTypes=Movie,Video,Episode&Limit=500');
    return data?.Items ?? [];
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.request(`/Items/${itemId}`, { method: 'DELETE' });
  }

  async getStreamUrl(itemId: string, deviceId: string): Promise<string> {
    return `${this.baseUrl}/Videos/${itemId}/stream?api_key=${this.apiKey}&DeviceId=${encodeURIComponent(deviceId)}&Static=true`;
  }
}
