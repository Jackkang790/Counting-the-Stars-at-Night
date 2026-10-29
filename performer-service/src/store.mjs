import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export class Store {
  constructor(folder) {
    mkdirSync(folder,{recursive:true}); this.folder=resolve(folder); this.owner=randomUUID();
    this.db=new DatabaseSync(resolve(folder,'studio.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS published(id TEXT PRIMARY KEY,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,job TEXT,time TEXT,body TEXT);
      CREATE TABLE IF NOT EXISTS lease(id INTEGER PRIMARY KEY,owner TEXT,expires INTEGER);`);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const lease=this.db.prepare('SELECT * FROM lease WHERE id=1').get();
      if(lease && lease.expires>Date.now())throw Error('Another performer worker holds the database lease. Retry after 60 seconds.');
      this.db.prepare('INSERT OR REPLACE INTO lease VALUES(1,?,?)').run(this.owner,Date.now()+60000);this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');this.db.close();throw e}
    this.heartbeat=setInterval(()=>this.db.prepare('UPDATE lease SET expires=? WHERE id=1 AND owner=?').run(Date.now()+60000,this.owner),15000);this.heartbeat.unref();
    for(const job of this.list()) if(job.status==='running') {
      job.status=Object.values(job.tasks??{}).some(t=>t.state==='submitting'&&!t.id)?'needs_reconciliation':'queued';
      job.error=job.status==='needs_reconciliation'?'외부 작업 제출 중 재시작되었습니다. 제공자 작업 ID를 확인하세요. 자동 재결제하지 않습니다.':null;this.save(job);
    }
  }
  assertOwner(){const row=this.db.prepare('SELECT * FROM lease WHERE id=1').get();if(row?.owner!==this.owner||row.expires<Date.now())throw Error('Worker lease lost')}
  list(){return this.db.prepare('SELECT body FROM jobs ORDER BY rowid DESC').all().map(r=>JSON.parse(r.body))}
  get(id){const row=this.db.prepare('SELECT body FROM jobs WHERE id=?').get(id);if(!row)throw Object.assign(Error('작업을 찾을 수 없습니다'),{status:404});return JSON.parse(row.body)}
  save(job){this.assertOwner();job.updatedAt=new Date().toISOString();this.db.prepare('INSERT OR REPLACE INTO jobs VALUES(?,?)').run(job.id,JSON.stringify(job));return job}
  event(job,type,detail={}){this.db.prepare('INSERT INTO events(job,time,body) VALUES(?,?,?)').run(job,new Date().toISOString(),JSON.stringify({type,...detail}))}
  events(id){return this.db.prepare('SELECT time,body FROM events WHERE job=? ORDER BY id').all(id).map(r=>({time:r.time,...JSON.parse(r.body)}))}
  registry(){return this.db.prepare('SELECT body FROM published ORDER BY rowid DESC').all().map(r=>JSON.parse(r.body))}
  publish(actor){this.db.prepare('INSERT INTO published VALUES(?,?)').run(actor.id,JSON.stringify(actor));return actor}
  close(){clearInterval(this.heartbeat);this.db.prepare('DELETE FROM lease WHERE owner=?').run(this.owner);this.db.close()}
}
