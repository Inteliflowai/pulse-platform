export default function ApiDocsPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pulse API Documentation</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e5e7eb; }
          .header { background: #1e2130; border-bottom: 1px solid #374151; padding: 24px 40px; }
          .header h1 { font-size: 24px; }
          .header p { color: #9ca3af; margin-top: 4px; font-size: 14px; }
          .content { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
          .section { margin-bottom: 32px; }
          .section h2 { font-size: 18px; color: #f5803e; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #374151; }
          .endpoint { background: #1e2130; border: 1px solid #374151; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
          .endpoint-header { padding: 12px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; }
          .method { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; min-width: 50px; text-align: center; }
          .method.get { background: #064e3b; color: #34d399; }
          .method.post { background: #1e3a5f; color: #60a5fa; }
          .method.patch { background: #3f3520; color: #fbbf24; }
          .method.delete { background: #450a0a; color: #f87171; }
          .path { font-family: monospace; font-size: 13px; color: #e5e7eb; }
          .desc { font-size: 12px; color: #9ca3af; margin-left: auto; }
          .detail { padding: 0 16px 16px; font-size: 13px; color: #9ca3af; }
          .detail pre { background: #0f1117; border: 1px solid #374151; border-radius: 6px; padding: 12px; margin: 8px 0; font-size: 12px; overflow-x: auto; color: #d1d5db; }
          .detail .label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-top: 12px; margin-bottom: 4px; }
          .tag { font-size: 10px; background: #374151; color: #9ca3af; padding: 2px 6px; border-radius: 3px; }
        `}</style>
      </head>
      <body>
        <div className="header">
          <h1>Pulse API Documentation</h1>
          <p>REST API for Inteliflow Pulse — school content delivery platform</p>
        </div>
        <div className="content">

          <div className="section">
            <h2>Authentication</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
              API routes use Supabase Auth (session cookies) for dashboard endpoints and header tokens for node endpoints.
              Node services authenticate via <code>X-Node-Token</code> header with the registration token.
            </p>
          </div>

          <div className="section">
            <h2>Nodes</h2>
            {endpoint('POST', '/api/nodes/register', 'Register a new node', '{ registration_token, hostname, version, ip_address, storage_total_gb }', '{ node_id, node_name, site_id, tenant_id, jellyfin_api_key, cloud_api_url }')}
            {endpoint('POST', '/api/nodes/heartbeat', 'Send node heartbeat with metrics', '{ node_id, timestamp, version, cpu_usage_pct, memory_used_gb, ... }', '{ ok, server_time }')}
            {endpoint('GET', '/api/nodes/[nodeId]/config', 'Get node configuration', null, '{ classrooms, device_policies, feature_flags, current_packages }', 'x-node-secret header')}
            {endpoint('POST', '/api/nodes/[nodeId]/events', 'Batch insert node events', '{ events: [{ event_type, severity, message }] }', '{ inserted: number }')}
          </div>

          <div className="section">
            <h2>Content & Sync</h2>
            {endpoint('POST', '/api/sync/enqueue', 'Create sync jobs for a package', '{ package_id, node_ids? }', '{ enqueued, jobs }')}
            {endpoint('GET', '/api/sync/node-jobs/[nodeId]', 'Get pending jobs for a node', null, '{ jobs: [...] }')}
            {endpoint('POST', '/api/sync/jobs/[jobId]/progress', 'Report sync progress', '{ bytes_transferred, progress_pct, status? }', '{ ok }')}
            {endpoint('POST', '/api/sync/jobs/[jobId]/complete', 'Complete a sync job', '{ status: "completed"|"failed", error_message? }', '{ ok }')}
            {endpoint('GET', '/api/assets/[assetId]/download-url', 'Get signed download URL', null, '{ url, expires_at }', 'X-Node-Token header')}
          </div>

          <div className="section">
            <h2>Classrooms & Devices</h2>
            {endpoint('GET', '/api/classrooms', 'List classrooms', null, '{ classrooms: [...] }')}
            {endpoint('POST', '/api/classrooms', 'Create classroom', '{ name, room_code, node_id, site_id, capacity }', '{ id, name, ... }')}
            {endpoint('GET', '/api/classrooms/[id]', 'Classroom detail with devices', null, '{ classroom, devices }')}
            {endpoint('POST', '/api/classrooms/[id]/enrollment-codes', 'Generate enrollment code', null, '{ device_id, enrollment_token, enroll_url, qr_data, expires_at }')}
            {endpoint('GET', '/api/devices/validate-token', 'Validate enrollment token', '?token=...', '{ valid, device_id, classroom_id, ... }')}
            {endpoint('POST', '/api/devices/[id]/enroll', 'Enroll a device', '{ local_session_token, ip_address }', '{ ok }')}
            {endpoint('POST', '/api/devices/[id]/revoke', 'Revoke a device', null, '{ ok }')}
            {endpoint('PATCH', '/api/devices/[id]', 'Rename device', '{ name }', '{ ok }')}
            {endpoint('POST', '/api/devices/[id]/rotate-token', 'Rotate enrollment token', null, '{ enrollment_token, expires_at }')}
          </div>

          <div className="section">
            <h2>Curriculum</h2>
            {endpoint('GET', '/api/curriculum', 'Get grades, subjects, terms, class groups', null, '{ grades, subjects, terms, class_groups }')}
            {endpoint('POST', '/api/curriculum', 'Create grade/subject/term/class_group', '{ type: "grade"|"subject"|..., name, ... }', '{ id, name, ... }')}
            {endpoint('GET', '/api/curriculum/sequences', 'List learning sequences', null, '{ sequences: [...] }')}
            {endpoint('POST', '/api/curriculum/sequences', 'Create sequence with items', '{ name, description, grade_id, subject_id, items? }', '{ id, name, ... }')}
            {endpoint('GET', '/api/curriculum/sequences/[id]', 'Sequence detail with items', null, '{ sequence, items }')}
          </div>

          <div className="section">
            <h2>Quizzes & Progress</h2>
            {endpoint('POST', '/api/quiz', 'Create quiz with questions', '{ title, time_limit_minutes, pass_percentage, questions: [...] }', '{ id, title, ... }')}
            {endpoint('GET', '/api/quiz/[quizId]', 'Quiz detail with questions + stats', null, '{ quiz, questions, stats }')}
            {endpoint('POST', '/api/progress', 'Sync progress + quiz results from node', '{ progress_records?, quiz_attempts? }', '{ ok }')}
          </div>

          <div className="section">
            <h2>Updates & System</h2>
            {endpoint('GET', '/api/updates/available', 'Check for updates', '?node_id=...', '{ update_available, latest_version, download_url, ... }')}
            {endpoint('POST', '/api/updates/[assignmentId]/status', 'Report update status', '{ status, error? }', '{ ok }')}
            {endpoint('GET', '/api/cron/check-offline-nodes', 'Mark stale nodes offline', null, '{ checked, marked_offline }', 'x-cron-secret header')}
            {endpoint('GET', '/api/reports', 'Export CSV reports', '?type=quiz_results|progress&format=csv', 'CSV file download')}
            {endpoint('POST', '/api/bulk', 'Bulk operations', '{ action, ids, data }', '{ ok, affected }')}
          </div>

          <div className="section">
            <h2>Notifications</h2>
            {endpoint('GET', '/api/notifications', 'List notifications', '?unread=true', '{ notifications: [...] }')}
            {endpoint('POST', '/api/notifications', 'Create notification', '{ tenant_id, user_id?, type, title, message }', '{ id, ... }')}
            {endpoint('PATCH', '/api/notifications', 'Mark as read', '{ ids?: [...] }', '{ ok }')}
          </div>

          <div className="section">
            <h2>Users</h2>
            {endpoint('POST', '/api/users/invite', 'Invite user by email', '{ email, role, site_id?, tenant_id? }', '{ ok, user_id }')}
          </div>

          <div className="section">
            <h2>Node Agent Endpoints (port 3100)</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>These run on the school appliance, not the cloud.</p>
            {endpoint('GET', '/health', 'Health check', null, '{ ok, enrolled_devices, active_sessions, wan_connected }')}
            {endpoint('GET', '/enroll?code=...', 'Device enrollment (redirects to classroom)', null, 'Redirect to /classroom')}
            {endpoint('GET', '/classroom?token=...', 'Classroom player HTML', null, 'HTML page')}
            {endpoint('GET', '/packages?token=...', 'List local packages (offline)', null, '{ packages: [...] }')}
            {endpoint('GET', '/sequences?token=...', 'List sequences (cached/cloud)', null, '{ sequences: [...] }')}
            {endpoint('GET', '/stream/[assetId]?token=...', 'Redirect to Jellyfin stream', null, '302 redirect')}
            {endpoint('POST', '/quiz/submit', 'Submit quiz answers', '{ token, quiz_id, answers, score, ... }', '{ ok, score, percentage, passed }')}
            {endpoint('GET', '/conductor?token=...', 'Teacher conductor page', null, 'HTML page')}
            {endpoint('GET', '/conductor/state?token=...', 'Poll conductor state', null, '{ active, sequence_id?, current_item_index? }')}
            {endpoint('POST', '/conductor/update', 'Push conductor state', '{ token, classroom_id, sequence_id, current_item_index }', '{ ok }')}
            {endpoint('POST', '/backup', 'Create database backup', null, '{ ok, path }')}
            {endpoint('GET', '/backups', 'List backups', null, '{ backups: [...] }')}
          </div>
        </div>
      </body>
    </html>
  );
}

function endpoint(method: string, path: string, description: string, body: string | null, response: string, auth?: string) {
  const m = method.toLowerCase();
  return (
    <div className="endpoint">
      <div className="endpoint-header">
        <span className={`method ${m}`}>{method}</span>
        <span className="path">{path}</span>
        <span className="desc">{description}</span>
      </div>
      <div className="detail">
        {auth && <><div className="label">Auth</div><p>{auth}</p></>}
        {body && <><div className="label">Request Body</div><pre>{body}</pre></>}
        <div className="label">Response</div><pre>{response}</pre>
      </div>
    </div>
  );
}
