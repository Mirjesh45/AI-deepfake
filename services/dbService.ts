
import { AnalysisState } from '../types';

const DB_NAME = 'SentinelForensicDB';
const DB_VERSION = 2; // Incremented for schema update

export interface AuditEntry {
  id: string;
  operatorId: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface UserProfile {
  id: string;
  passwordHash: string;
  salt: string; // Base64 encoded salt
  iterations: number;
}

export class DatabaseService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Users Store
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        
        // Investigations Store
        if (!db.objectStoreNames.contains('investigations')) {
          const invStore = db.createObjectStore('investigations', { keyPath: 'id' });
          invStore.createIndex('operatorId', 'operatorId', { unique: false });
        }

        // Audit Logs Store
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('operatorId', 'operatorId', { unique: false });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(new Error('DATABASE_INIT_FAILURE'));
    });
  }

  async logAction(operatorId: string, action: string, details: string): Promise<void> {
    await this.init();
    const log: AuditEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      operatorId,
      action,
      details,
      timestamp: Date.now()
    };
    const transaction = this.db!.transaction(['logs'], 'readwrite');
    transaction.objectStore('logs').add(log);
  }

  async getRecentLogs(operatorId: string, limit: number = 20): Promise<AuditEntry[]> {
    await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      const index = store.index('operatorId');
      const request = index.getAll(operatorId);
      request.onsuccess = () => {
        const sorted = (request.result as AuditEntry[]).sort((a, b) => b.timestamp - a.timestamp);
        resolve(sorted.slice(0, limit));
      };
    });
  }

  async saveInvestigation(analysis: AnalysisState, operatorId: string): Promise<void> {
    await this.init();
    const transaction = this.db!.transaction(['investigations', 'logs'], 'readwrite');
    const store = transaction.objectStore('investigations');
    const data = { ...analysis, operatorId, timestamp: Date.now() };
    store.put(data);
    
    // Auto-log the completion
    if (!analysis.isAnalyzing && analysis.result) {
      this.logAction(operatorId, 'ANALYSIS_COMPLETE', `Target: ${analysis.fileName} - Verdict: ${analysis.result.verdict}`);
    }
    
    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  }

  async getInvestigations(operatorId: string): Promise<AnalysisState[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['investigations'], 'readonly');
      const store = transaction.objectStore('investigations');
      const index = store.index('operatorId');
      const request = index.getAll(operatorId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('FETCH_FAILURE'));
    });
  }

  async deleteInvestigation(id: string): Promise<void> {
    await this.init();
    const transaction = this.db!.transaction(['investigations'], 'readwrite');
    transaction.objectStore('investigations').delete(id);
    return new Promise((resolve) => transaction.oncomplete = () => resolve());
  }

  async clearOperatorInvestigations(operatorId: string): Promise<void> {
    await this.init();
    const investigations = await this.getInvestigations(operatorId);
    const transaction = this.db!.transaction(['investigations', 'logs'], 'readwrite');
    const store = transaction.objectStore('investigations');
    investigations.forEach(inv => store.delete(inv.id));
    this.logAction(operatorId, 'BATCH_PURGE', `Deleted ${investigations.length} records.`);
    return new Promise((resolve) => transaction.oncomplete = () => resolve());
  }

  async saveUser(profile: UserProfile): Promise<void> {
    await this.init();
    const transaction = this.db!.transaction(['users'], 'readwrite');
    transaction.objectStore('users').put(profile);
    return new Promise((resolve) => transaction.oncomplete = () => resolve());
  }

  async getUser(id: string): Promise<UserProfile | null> {
    await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['users'], 'readonly');
      const request = transaction.objectStore('users').get(id);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
}

export const dbService = new DatabaseService();
