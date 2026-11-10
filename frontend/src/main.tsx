import { StrictMode, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, createApi, type Api, type Collection, type Interest, type Note, type Pagination, type Post, type Session, type User } from './api';
import './style.css';

type ReportError = (error: unknown) => void;
const registrationInterests = ['Chess', 'Reading', 'Music', 'Sports', 'Technology', 'Travel', 'Art', 'Cooking', 'Gaming', 'Writing'];
function RequiredMark() { return <span className="required-mark" aria-hidden="true">*</span>; }
type IconName = 'dashboard' | 'notes' | 'posts' | 'users' | 'all-notes' | 'interests' | 'shield' | 'arrow' | 'logout';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    dashboard: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
    notes: 'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M8 16l1-4L18 3l3 3-9 9-4 1Z',
    posts: 'M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7a4 4 0 0 1 0 8m5 9v-2a4 4 0 0 0-3-4',
    'all-notes': 'M8 3h12v14H8V3ZM4 7v14h12M11 7h6m-6 4h6',
    interests: 'M12 3v5m0 8v5M3 12h5m8 0h5M12 8l4 4-4 4-4-4 4-4ZM5 5l3 3m8 8 3 3M19 5l-3 3M8 16l-3 3',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    logout: 'M9 4H4v16h5m5-12 4 4-4 4m-5-4h13',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function Brand() { return <div className="brand"><span className="brand-symbol"><Icon name="notes" size={23} /></span><span>Secure<span className="brand-light">Notes</span><small>A place for your ideas.</small></span></div>; }
function EmptyState({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={26} /></span><h3>{title}</h3><p>{description}</p></div>;
}
function Initials({ name }: { name: string }) { return <span className="avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>; }
function useCollection<T>(path: string, api: Api, onError: ReportError) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Collection<T>>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setResult(undefined);
    api<Collection<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=10`, { signal: abort.signal })
      .then(data => { if (!abort.signal.aborted) setResult(data); })
      .catch(error => { if (!abort.signal.aborted) onError(error); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [path, api, page, revision, onError]);
  return { result, loading, page, setPage, reload: () => setRevision(value => value + 1) };
}
function Pager({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  return <div className="pager">
    <button className="button-secondary" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>← Previous</button>
    <span>Page {pagination.page} of {Math.max(1, pagination.pages)} · {pagination.total} results</span>
    <button className="button-secondary" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next →</button>
  </div>;
}
function AuthForm({ api, onSession, onError }: { api: Api; onSession: (session: Session) => void; onError: ReportError }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [interestsError, setInterestsError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const data = { email: String(fields.get('email')), password: String(fields.get('password')) };
    const selectedInterests = fields.getAll('interests').map(String).filter(Boolean);
    if (register && data.password !== String(fields.get('confirmPassword'))) {
      setPasswordError('Passwords do not match. Please enter the same password again.');
      const confirmation = event.currentTarget.elements.namedItem('confirmPassword');
      if (confirmation instanceof HTMLInputElement) confirmation.focus();
      return;
    }
    setPasswordError('');
    if (register && selectedInterests.length === 0) {
      setInterestsError('Select at least one interest.');
      event.currentTarget.querySelector<HTMLInputElement>('input[name="interests"]')?.focus();
      return;
    }
    setInterestsError('');
    setBusy(true);
    try {
      onSession(await api<Session>(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(register ? { ...data, name: fields.get('name'), interests: selectedInterests } : data) }));
    } catch (error) { onError(error); } finally { setBusy(false); }
  }
  return <section className="auth-section">
    <div className="auth-story"><span className="eyebrow">THINK. WRITE. KEEP.</span><h2>Good ideas deserve<br />a place of their own.</h2><p>Keep your personal notes together, share what inspires you, and make room for your next idea.</p>
      <div className="note-illustration" aria-hidden="true"><div className="illustration-tab">A little clarity, every day</div><div className="illustration-paper"><span className="paper-dot" /><span className="paper-label">A thought worth keeping</span><strong>Start with an idea.</strong><span className="paper-line" /><span className="paper-line short" /><div className="paper-tags"><span>Personal</span><span>Ideas</span></div></div></div>
      <div className="auth-assurance"><Icon name="shield" /><div><strong>Your notes stay personal</strong><span>You decide what to write and what to share.</span></div></div>
    </div>
    <div className="auth-form-wrap"><span className="eyebrow">YOUR PERSONAL WORKSPACE</span><h2>{register ? 'Create your account' : 'Welcome back'}</h2><p className="section-description">{register ? 'A few details, and you’re ready to get started.' : 'Sign in to pick up where you left off.'}</p>
    <form className="auth-form" onSubmit={submit}>
      {register && <><small>Fields marked <RequiredMark /> are required.</small><label><span>Name <RequiredMark /></span><input name="name" required maxLength={100} autoComplete="name" /></label></>}
      <label><span>Email {register && <RequiredMark />}</span><input name="email" type="email" required autoComplete="email" /></label>
      <label><span>Password {register && <RequiredMark />}</span><input name="password" type="password" required minLength={register ? 12 : 1} autoComplete={register ? 'new-password' : 'current-password'} onChange={() => setPasswordError('')} /></label>
      {register && <>
        <label><span>Confirm password <RequiredMark /></span><input name="confirmPassword" type="password" required minLength={12} autoComplete="new-password" aria-invalid={!!passwordError || undefined} aria-describedby={passwordError ? 'confirm-password-error' : undefined} onChange={() => setPasswordError('')} /></label>
        {passwordError && <small id="confirm-password-error" role="alert">{passwordError}</small>}
      </>}
      {register && <><small>Use 12 or more characters, up to 72 UTF-8 bytes.</small>
        <fieldset className="interests-fieldset" aria-describedby={interestsError ? 'interests-hint interests-error' : 'interests-hint'} onChange={() => setInterestsError('')}>
          <legend>Interests <RequiredMark /></legend>
          <small id="interests-hint">Select one or more interests.</small>
          <div className="interest-options">{registrationInterests.map(interest => <label className="interest-option" key={interest}><input type="checkbox" name="interests" value={interest.toLowerCase()} />{interest}</label>)}</div>
          {interestsError && <small id="interests-error" className="required-mark" role="alert">{interestsError}</small>}
        </fieldset>
      </>}
      <div className="auth-actions"><button disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}<Icon name="arrow" size={18} /></button>
        <p>{register ? 'Already have an account?' : 'New to SecureNotes?'} <button className="button-link" type="button" onClick={() => { setRegister(value => !value); setPasswordError(''); setInterestsError(''); }}>{register ? 'Sign in' : 'Create an account'}</button></p></div>
    </form>
    </div>
  </section>;
}
function ContentForm({ initial, label, onSave, onCancel, onError }: {
  initial?: { title: string; content: string }; label: string; onSave: (data: { title: string; content: string }) => Promise<void>; onCancel?: () => void; onError: ReportError;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try { await onSave({ title: String(fields.get('title')), content: String(fields.get('content')) }); if (!initial) form.reset(); }
    catch (error) { onError(error); } finally { setBusy(false); }
  }
  return <form className="composer" onSubmit={submit}>
    <div className="composer-heading"><Icon name={label === 'Publish post' ? 'posts' : 'notes'} /><span>{initial ? 'Refine your note' : label === 'Publish post' ? 'Share a thought' : 'Capture something new'}</span><span className="visibility-badge">{label === 'Publish post' ? 'Public' : 'Private'}</span></div>
    <label>Title<input name="title" required maxLength={200} defaultValue={initial?.title} placeholder="Give your idea a title" /></label>
    <label>Content<textarea name="content" required={label === 'Publish post'} maxLength={20000} rows={4} defaultValue={initial?.content} placeholder={label === 'Publish post' ? 'What would you like to share?' : 'A thought, a plan, a little inspiration…'} /></label>
    <div className="actions"><button disabled={busy}>{busy ? 'Saving…' : label}<Icon name="arrow" size={16} /></button>{onCancel && <button className="button-secondary" type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}
function Notes({ api, all, onError }: { api: Api; all: boolean; onError: ReportError }) {
  const list = useCollection<Note>(all ? '/admin/notes' : '/notes', api, onError);
  const [editing, setEditing] = useState<Note>();
  async function save(data: { title: string; content: string }) {
    await api(editing ? `/notes/${editing._id}` : '/notes', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(data) });
    setEditing(undefined); list.reload();
  }
  async function remove(note: Note) {
    if (!window.confirm(`Delete note “${note.title}”?`)) return;
    try { await api(`/notes/${note._id}`, { method: 'DELETE' }); setEditing(undefined); if (list.result?.data.length === 1 && list.page > 1) list.setPage(list.page - 1); else list.reload(); }
    catch (error) { onError(error); }
  }
  return <section className="panel"><div className="section-head"><div><h2>{all ? 'Notes across your workspace' : 'Your notebook'}</h2><p className="section-description">{all ? 'A read-only view of everyone’s notes.' : 'A home for the things you want to remember.'}</p></div>{list.result && <span className="count-badge">{list.result.pagination.total} notes</span>}</div>
    {!all && <ContentForm key={editing?._id || 'new'} initial={editing} label={editing ? 'Save changes' : 'Create note'} onSave={save} onCancel={editing ? () => setEditing(undefined) : undefined} onError={onError} />}
    {list.loading && <p role="status">Loading notes…</p>}
    {list.result?.data.length === 0 && <EmptyState icon="notes" title={all ? 'No notes to show yet' : 'Your next idea starts here'} description={all ? 'Notes created by users will appear in this view.' : 'Use the editor above to write your first note.'} />}
    <div className="card-grid">{list.result?.data.map(note => <article className="note-card" key={note._id}><div className="card-kicker"><Icon name="notes" size={16} /><span>NOTE</span></div><h3>{note.title}</h3><p className="content">{note.content || 'No content added.'}</p>
      {all ? <small className="card-footer">Owner: {note.owner}</small> : <div className="actions card-footer"><button className="button-secondary button-small" onClick={() => setEditing(note)}>Edit note</button><button className="button-danger button-small" onClick={() => remove(note)}>Delete</button></div>}
    </article>)}</div>
    {list.result && <Pager pagination={list.result.pagination} onPage={list.setPage} />}
  </section>;
}
function UserForm({ initial, onSave, onCancel, onError }: { initial?: User; onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void; onError: ReportError }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const data: Record<string, unknown> = { name: fields.get('name'), email: fields.get('email'), role: fields.get('role'), interests: String(fields.get('interests')).split(',').map(value => value.trim()).filter(Boolean) };
    if (fields.get('password')) data.password = fields.get('password');
    setBusy(true);
    try { await onSave(data); } catch (error) { onError(error); } finally { setBusy(false); }
  }
  return <form className="composer user-editor" onSubmit={submit}><h3>{initial ? 'Edit user' : 'Add a new user'}</h3>
    <label>Name<input name="name" required maxLength={100} defaultValue={initial?.name} /></label>
    <label>Email<input name="email" type="email" required defaultValue={initial?.email} /></label>
    <label>{initial ? 'New password (leave blank to keep)' : 'Password'}<input name="password" type="password" minLength={12} required={!initial} autoComplete="new-password" /></label>
    <label>Role<select name="role" defaultValue={initial?.role || 'user'}><option value="user">User</option><option value="admin">Admin</option></select></label>
    <label>Interests, separated by commas<input name="interests" defaultValue={initial?.interests.join(', ')} /></label>
    <div className="actions"><button disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button><button className="button-secondary" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}
function Users({ api, selfId, onError }: { api: Api; selfId: string; onError: ReportError }) {
  const list = useCollection<User>('/admin/users', api, onError);
  const [editor, setEditor] = useState<User | 'new'>();
  async function save(data: Record<string, unknown>) {
    await api(editor === 'new' ? '/admin/users' : `/admin/users/${editor?._id}`, { method: editor === 'new' ? 'POST' : 'PATCH', body: JSON.stringify(data) });
    setEditor(undefined); list.reload();
    if (editor !== 'new' && editor?._id === selfId) {
      // Refresh role/profile and detect a session invalidated by a credential change.
      await api('/auth/me');
    }
  }
  async function remove(user: User) {
    if (!window.confirm(`Remove ${user.email}? Their existing content will be retained.`)) return;
    try { await api(`/admin/users/${user._id}`, { method: 'DELETE' }); if (list.result?.data.length === 1 && list.page > 1) list.setPage(list.page - 1); else list.reload(); }
    catch (error) { onError(error); }
  }
  return <section className="panel"><div className="section-head"><div><h2>People in your workspace</h2><p className="section-description">Manage profiles, interests, and account access.</p></div><button onClick={() => setEditor('new')}>+ Add user</button></div>
    {editor && <UserForm key={editor === 'new' ? 'new' : editor._id} initial={editor === 'new' ? undefined : editor} onSave={save} onCancel={() => setEditor(undefined)} onError={onError} />}
    {list.loading && <p role="status">Loading users…</p>}
    <div className="user-list">{list.result?.data.map(user => <article className="user-card" key={user._id}><div className="user-card-main"><Initials name={user.name} /><div className="user-identity"><h3>{user.name}<span className={`role-badge ${user.role}`}>{user.role}</span></h3><p>{user.email}</p></div></div><div className="tag-list">{user.interests.length ? user.interests.map(interest => <span className="tag" key={interest}>{interest}</span>) : <small>No interests added</small>}</div><small className="user-id">ID: {user._id}</small>
      <div className="actions"><button className="button-secondary button-small" onClick={() => setEditor(user)}>Edit profile</button><button className="button-danger button-small" disabled={user._id === selfId} onClick={() => remove(user)}>Remove</button></div>
    </article>)}</div>
    {list.result && <Pager pagination={list.result.pagination} onPage={list.setPage} />}
  </section>;
}
function InterestGroups({ api, onError }: { api: Api; onError: ReportError }) {
  const [memberPage, setMemberPage] = useState(1);
  const list = useCollection<Interest>(`/admin/users/by-interest?memberPage=${memberPage}&memberLimit=10`, api, onError);
  return <section className="panel"><div className="section-head"><div><h2>Shared interests</h2><p className="section-description">Explore the interests that bring people together.</p></div>{list.result && <span className="count-badge">{list.result.pagination.total} groups</span>}</div>
    {list.loading && <p role="status">Loading interest groups…</p>}
    {list.result?.data.length === 0 && <EmptyState icon="interests" title="A little more in common" description="Interest groups will appear as users add interests to their profiles." />}
    <div className="card-grid">{list.result?.data.map(group => <article className="interest-card" key={group.interest}><div className="interest-card-heading"><span className="interest-icon"><Icon name="interests" /></span><h3>{group.interest}</h3><span className="count-badge">{group.totalUsers}</span></div>
      <ul className="member-list">{group.users.map(user => <li key={user._id}><Initials name={user.name} /><div><strong>{user.name}</strong><small>{user.email}</small></div></li>)}</ul>
      {group.users.length === 0 && <p>No members on this page.</p>}
    </article>)}</div>
    <div className="pager"><button disabled={memberPage <= 1 || list.loading} onClick={() => setMemberPage(value => value - 1)}>Previous members</button><span>Member page {memberPage}</span>
      <button disabled={list.loading || !list.result?.data.some(group => group.memberPagination.pages > memberPage)} onClick={() => setMemberPage(value => value + 1)}>Next members</button></div>
    {list.result && <Pager pagination={list.result.pagination} onPage={page => { list.setPage(page); setMemberPage(1); }} />}
  </section>;
}
function Posts({ api, signedIn, onError }: { api: Api; signedIn: boolean; onError: ReportError }) {
  const [author, setAuthor] = useState('');
  const list = useCollection<Post>(author ? `/users/${author}/posts` : '/posts', api, onError);
  return <section className="panel"><div className="section-head"><div><h2>The community board</h2><p className="section-description">Ideas and stories shared with everyone.</p></div><span className="visibility-badge"><span className="status-dot" />Public</span></div>
    {signedIn && <ContentForm label="Publish post" onSave={async data => { await api('/posts', { method: 'POST', body: JSON.stringify(data) }); list.reload(); }} onError={onError} />}
    <form className="filter-form" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); setAuthor(String(fields.get('author')).trim()); list.setPage(1); }}>
      <label>Find posts by author<input name="author" pattern="[a-fA-F0-9]{24}" placeholder="Enter a user ID, or leave blank for everyone" /></label><button className="button-secondary">Apply filter</button>
    </form>
    {author && <p>Showing posts by {author}. <button onClick={() => { setAuthor(''); list.setPage(1); }}>Show all posts</button></p>}
    {list.loading && <p role="status">Loading posts…</p>}
    {list.result?.data.length === 0 && <EmptyState icon="posts" title={author ? 'No posts from this author yet' : 'Every conversation starts with an idea'} description={author ? 'Try another user ID or clear the author filter.' : signedIn ? 'Use the editor above to share the first post.' : 'Sign in to share a thought with the community.'} />}
    <div className="card-grid">{list.result?.data.map(post => <article className="post-card" key={post._id}><div className="card-kicker"><Icon name="posts" size={16} /><span>COMMUNITY POST</span></div><h3>{post.title}</h3><p className="content">{post.content}</p><div className="card-footer"><button className="button-link" onClick={() => { setAuthor(post.author); list.setPage(1); }}>More from this author <Icon name="arrow" size={15} /></button><small>Author: {post.author}</small></div></article>)}</div>
    {list.result && <Pager pagination={list.result.pagination} onPage={list.setPage} />}
  </section>;
}
function AdminDashboard({ api, onError, onTab }: { api: Api; onError: ReportError; onTab: (tab: string) => void }) {
  const [data, setData] = useState<{ users: Collection<User>; notes: Collection<Note>; posts: Collection<Post>; interests: Collection<Interest> }>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    const options = { signal: controller.signal };
    Promise.all([
      api<Collection<User>>('/admin/users?limit=5', options),
      api<Collection<Note>>('/admin/notes?limit=5', options),
      api<Collection<Post>>('/posts?limit=1', options),
      api<Collection<Interest>>('/admin/users/by-interest?limit=6&memberLimit=1', options),
    ]).then(([users, notes, posts, interests]) => {
      if (!controller.signal.aborted) setData({ users, notes, posts, interests });
    }).catch(error => { if (!controller.signal.aborted) { setFailed(true); onError(error); } });
    return () => controller.abort();
  }, [api, onError, revision]);
  if (failed) return <section className="panel"><EmptyState icon="dashboard" title="Your dashboard couldn’t load" description="Please try again to load the latest workspace data." /><div className="actions dashboard-view-all"><button onClick={() => setRevision(value => value + 1)}>Try again</button></div></section>;
  if (!data) return <div className="loading-state" role="status">Loading your dashboard…</div>;
  const summaries: { label: string; count: number; icon: IconName; tab: string; color: string }[] = [
    { label: 'Total users', count: data.users.pagination.total, icon: 'users', tab: 'users', color: 'purple' },
    { label: 'Private notes', count: data.notes.pagination.total, icon: 'notes', tab: 'all-notes', color: 'blue' },
    { label: 'Public posts', count: data.posts.pagination.total, icon: 'posts', tab: 'posts', color: 'green' },
    { label: 'Interest groups', count: data.interests.pagination.total, icon: 'interests', tab: 'interests', color: 'orange' },
  ];
  const largestGroup = Math.max(1, ...data.interests.data.map(group => group.totalUsers));
  return <div className="dashboard">
    <div className="summary-grid">{summaries.map(summary => <button className={`summary-card ${summary.color}`} key={summary.label} onClick={() => onTab(summary.tab)}><span className="summary-icon"><Icon name={summary.icon} size={28} /></span><span><strong>{summary.count.toLocaleString()}</strong><span>{summary.label}</span></span><Icon name="arrow" size={17} /></button>)}</div>
    <div className="dashboard-grid"><section className="panel"><div className="section-head"><div><h2>Recent users</h2><p className="section-description">The latest accounts in your workspace.</p></div><button className="button-link" onClick={() => onTab('users')}>View all <Icon name="arrow" size={16} /></button></div>
      <div className="dashboard-user-list">{data.users.data.map(user => <div className="dashboard-user" key={user._id}><Initials name={user.name} /><div><strong>{user.name}</strong><small>{user.email}</small></div><span className={`role-badge ${user.role}`}>{user.role}</span></div>)}</div>
      {data.users.data.length === 0 && <EmptyState icon="users" title="No users yet" description="New accounts will appear here." />}
    </section>
    <section className="panel"><div className="section-head"><div><h2>Interests overview</h2><p className="section-description">Members per group · first six alphabetically.</p></div><Icon name="interests" /></div>
      <div className="interest-chart">{data.interests.data.map(group => <div className="interest-bar" key={group.interest}><div><span>{group.interest}</span><strong>{group.totalUsers}</strong></div><div className="bar-track"><span style={{ width: `${group.totalUsers / largestGroup * 100}%` }} /></div></div>)}</div>
      {data.interests.data.length === 0 && <EmptyState icon="interests" title="No interests yet" description="Groups appear when users add interests." />}
      <button className="button-link dashboard-view-all" onClick={() => onTab('interests')}>Explore interest groups <Icon name="arrow" size={16} /></button>
    </section></div>
    <section className="panel"><div className="section-head"><div><h2>Recent notes</h2><p className="section-description">The latest notes across the workspace.</p></div><button className="button-link" onClick={() => onTab('all-notes')}>View all notes <Icon name="arrow" size={16} /></button></div>
      <div className="recent-note-list">{data.notes.data.map(note => <div className="recent-note" key={note._id}><span className="recent-note-icon"><Icon name="notes" /></span><div><strong>{note.title}</strong><p>{note.content || 'No content added.'}</p></div><span className="visibility-badge">Private</span></div>)}</div>
      {data.notes.data.length === 0 && <EmptyState icon="notes" title="A fresh page" description="Notes will appear here as your users start writing." />}
    </section>
  </div>;
}
function App() {
  // JWT stays in memory. Reloading requires sign-in; no persistent browser token storage.
  const [session, setSession] = useState<Session>();
  const [tab, setTab] = useState('posts');
  const [error, setError] = useState('');
  const api = useMemo(() => createApi(session?.token), [session?.token]);
  const onError = useCallback((issue: unknown) => {
    setError(issue instanceof Error ? issue.message : 'Something went wrong');
    if (issue instanceof ApiError && issue.status === 401) { setSession(undefined); setTab('posts'); }
  }, []);
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); setSession(undefined); setTab('posts'); setError(''); }
    catch (issue) { onError(issue); }
  }
  const isAdmin = session?.user.role === 'admin';
  const navigation: { tab: IconName; label: string }[] = [
    ...(isAdmin ? [{ tab: 'dashboard' as const, label: 'Dashboard' }] : []),
    { tab: 'notes', label: 'My notes' }, { tab: 'posts', label: 'Community board' },
    ...(isAdmin ? [{ tab: 'users' as const, label: 'Manage users' }, { tab: 'all-notes' as const, label: 'All notes' }, { tab: 'interests' as const, label: 'Interest groups' }] : []),
  ];
  const pages: Record<string, { title: string; description: string }> = {
    dashboard: { title: 'Dashboard', description: 'A clear view of your people, notes, and shared ideas.' },
    notes: { title: 'My notes', description: 'Keep a little inspiration close at hand.' },
    posts: { title: 'Community board', description: 'A space for ideas that deserve to be shared.' },
    users: { title: 'User management', description: 'Bring your people and their interests together.' },
    'all-notes': { title: 'All notes', description: 'Browse notes across your workspace.' },
    interests: { title: 'Interest groups', description: 'Discover what your community has in common.' },
  };
  const currentPage = pages[tab] || pages.posts;
  function navigate(value: string) { setTab(value); setError(''); }
  return <div className={`app-shell ${session ? 'signed-in' : 'guest'} ${isAdmin ? 'admin-theme' : ''}`}>
    {session && <aside className="sidebar"><Brand /><span className="sidebar-label">{isAdmin ? 'ADMINISTRATION' : 'WORKSPACE'}</span><nav aria-label="Main navigation">{navigation.map(item => <button key={item.tab} aria-current={tab === item.tab ? 'page' : undefined} onClick={() => navigate(item.tab)}><Icon name={item.tab} /><span>{item.label}</span>{tab === item.tab && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Icon name="shield" /><strong>A space of your own.</strong><p>Personal notes. Shared inspiration.</p></div><div className="sidebar-account"><Initials name={session.user.name} /><div><strong>{session.user.name}</strong><small>{isAdmin ? 'Administrator' : 'Personal account'}</small></div></div><button className="sign-out" onClick={logout}><Icon name="logout" size={18} />Sign out</button></div>
    </aside>}
    <main className="workspace"><header className="topbar">{session ? <><div className="breadcrumb">{isAdmin ? 'Administration' : 'Workspace'}<span>/</span><strong>{currentPage.title}</strong></div><div className="topbar-account"><span className={`role-badge ${session.user.role}`}>{session.user.role}</span><Initials name={session.user.name} /></div></> : <><Brand /><a className="guest-community-link" href="#community">Explore the community <Icon name="arrow" size={17} /></a></>}</header>
      <div className="page-content">{session && <div className="page-heading"><div><span className="eyebrow">{isAdmin ? 'WORKSPACE OVERVIEW' : 'MAKE ROOM FOR YOUR IDEAS'}</span><h1>{currentPage.title}</h1><p>{currentPage.description}</p></div><span className="workspace-badge"><span className="status-dot" />{isAdmin ? 'Admin workspace' : 'Personal workspace'}</span></div>}
      {error && <div className="error" role="alert"><div><strong>Something needs your attention</strong><p>{error}</p></div><button className="button-secondary button-small" onClick={() => setError('')}>Dismiss</button></div>}
      {!session && <AuthForm api={api} onSession={value => { setSession(value); setError(''); setTab(value.user.role === 'admin' ? 'dashboard' : 'notes'); }} onError={onError} />}
      {isAdmin && tab === 'dashboard' && <AdminDashboard api={api} onError={onError} onTab={navigate} />}
      {tab === 'posts' && <div id="community" className={!session ? 'guest-community' : undefined}>{!session && <div className="community-intro"><span className="eyebrow">A LITTLE SHARED INSPIRATION</span><h1>Good ideas travel further together.</h1></div>}<Posts api={api} signedIn={!!session} onError={onError} /></div>}
      {session && tab === 'notes' && <Notes key="own" api={api} all={false} onError={onError} />}
      {isAdmin && tab === 'all-notes' && <Notes key="all" api={api} all onError={onError} />}
      {isAdmin && session && tab === 'users' && <Users api={api} selfId={session.user._id} onError={onError} />}
      {isAdmin && tab === 'interests' && <InterestGroups api={api} onError={onError} />}
      <footer className="workspace-footer"><span>SecureNotes</span><span>Make room for your next idea.</span></footer></div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
