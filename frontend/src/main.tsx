import { StrictMode, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, createApi, type Api, type Collection, type Interest, type Note, type Pagination, type Post, type Session, type User } from './api';
import './style.css';

type ReportError = (error: unknown) => void;
const registrationInterests = ['Chess', 'Reading', 'Music', 'Sports', 'Technology', 'Travel', 'Art', 'Cooking', 'Gaming', 'Writing'];
function RequiredMark() { return <span className="required-mark" aria-hidden="true">*</span>; }
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
    <button disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button>
    <span>Page {pagination.page} of {Math.max(1, pagination.pages)} · {pagination.total} results</span>
    <button disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next</button>
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
  return <section><h2>{register ? 'Create an account' : 'Sign in'}</h2>
    <form onSubmit={submit}>
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
      <div className="actions"><button disabled={busy}>{busy ? 'Please wait…' : register ? 'Register' : 'Sign in'}</button>
        <button type="button" onClick={() => { setRegister(value => !value); setPasswordError(''); setInterestsError(''); }}>{register ? 'Use an existing account' : 'Create an account'}</button></div>
    </form>
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
  return <form onSubmit={submit}>
    <label>Title<input name="title" required maxLength={200} defaultValue={initial?.title} /></label>
    <label>Content<textarea name="content" required={label === 'Publish post'} maxLength={20000} rows={4} defaultValue={initial?.content} /></label>
    <div className="actions"><button disabled={busy}>{busy ? 'Saving…' : label}</button>{onCancel && <button type="button" onClick={onCancel}>Cancel</button>}</div>
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
  return <section><h2>{all ? 'All users’ notes' : 'My notes'}</h2>
    {!all && <ContentForm key={editing?._id || 'new'} initial={editing} label={editing ? 'Save changes' : 'Create note'} onSave={save} onCancel={editing ? () => setEditing(undefined) : undefined} onError={onError} />}
    {list.loading && <p role="status">Loading notes…</p>}
    {list.result?.data.length === 0 && <p>No notes yet.</p>}
    {list.result?.data.map(note => <article key={note._id}><h3>{note.title}</h3><p className="content">{note.content}</p>
      {all ? <small>Owner: {note.owner}</small> : <div className="actions"><button onClick={() => setEditing(note)}>Edit</button><button onClick={() => remove(note)}>Delete</button></div>}
    </article>)}
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
  return <form onSubmit={submit}><h3>{initial ? 'Edit user' : 'Add user'}</h3>
    <label>Name<input name="name" required maxLength={100} defaultValue={initial?.name} /></label>
    <label>Email<input name="email" type="email" required defaultValue={initial?.email} /></label>
    <label>{initial ? 'New password (leave blank to keep)' : 'Password'}<input name="password" type="password" minLength={12} required={!initial} autoComplete="new-password" /></label>
    <label>Role<select name="role" defaultValue={initial?.role || 'user'}><option value="user">User</option><option value="admin">Admin</option></select></label>
    <label>Interests, separated by commas<input name="interests" defaultValue={initial?.interests.join(', ')} /></label>
    <div className="actions"><button disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
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
  return <section><h2>Manage users</h2><button onClick={() => setEditor('new')}>Add user</button>
    {editor && <UserForm key={editor === 'new' ? 'new' : editor._id} initial={editor === 'new' ? undefined : editor} onSave={save} onCancel={() => setEditor(undefined)} onError={onError} />}
    {list.loading && <p role="status">Loading users…</p>}
    {list.result?.data.map(user => <article key={user._id}><h3>{user.name} · {user.role}</h3><p>{user.email}</p><p>Interests: {user.interests.join(', ') || 'None'}</p><small>User ID: {user._id}</small>
      <div className="actions"><button onClick={() => setEditor(user)}>Edit</button><button disabled={user._id === selfId} onClick={() => remove(user)}>Remove</button></div>
    </article>)}
    {list.result && <Pager pagination={list.result.pagination} onPage={list.setPage} />}
  </section>;
}
function InterestGroups({ api, onError }: { api: Api; onError: ReportError }) {
  const [memberPage, setMemberPage] = useState(1);
  const list = useCollection<Interest>(`/admin/users/by-interest?memberPage=${memberPage}&memberLimit=10`, api, onError);
  return <section><h2>Users grouped by interest</h2>
    {list.loading && <p role="status">Loading interest groups…</p>}
    {list.result?.data.length === 0 && <p>No interests yet.</p>}
    {list.result?.data.map(group => <article key={group.interest}><h3>{group.interest} · {group.totalUsers} users</h3>
      <ul>{group.users.map(user => <li key={user._id}>{user.name} ({user.email})</li>)}</ul>
      {group.users.length === 0 && <p>No members on this page.</p>}
    </article>)}
    <div className="pager"><button disabled={memberPage <= 1 || list.loading} onClick={() => setMemberPage(value => value - 1)}>Previous members</button><span>Member page {memberPage}</span>
      <button disabled={list.loading || !list.result?.data.some(group => group.memberPagination.pages > memberPage)} onClick={() => setMemberPage(value => value + 1)}>Next members</button></div>
    {list.result && <Pager pagination={list.result.pagination} onPage={page => { list.setPage(page); setMemberPage(1); }} />}
  </section>;
}
function Posts({ api, signedIn, onError }: { api: Api; signedIn: boolean; onError: ReportError }) {
  const [author, setAuthor] = useState('');
  const list = useCollection<Post>(author ? `/users/${author}/posts` : '/posts', api, onError);
  return <section><h2>Public posts</h2>
    {signedIn && <ContentForm label="Publish post" onSave={async data => { await api('/posts', { method: 'POST', body: JSON.stringify(data) }); list.reload(); }} onError={onError} />}
    <form onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); setAuthor(String(fields.get('author')).trim()); list.setPage(1); }}>
      <label>Show one user’s posts (user ID)<input name="author" pattern="[a-fA-F0-9]{24}" placeholder="Leave blank for all posts" /></label><button>Apply filter</button>
    </form>
    {author && <p>Showing posts by {author}. <button onClick={() => { setAuthor(''); list.setPage(1); }}>Show all posts</button></p>}
    {list.loading && <p role="status">Loading posts…</p>}
    {list.result?.data.length === 0 && <p>No posts yet.</p>}
    {list.result?.data.map(post => <article key={post._id}><h3>{post.title}</h3><p className="content">{post.content}</p><button onClick={() => { setAuthor(post.author); list.setPage(1); }}>View this author’s posts</button><small>Author: {post.author}</small></article>)}
    {list.result && <Pager pagination={list.result.pagination} onPage={list.setPage} />}
  </section>;
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
  return <main><header><h1>Secure Notes</h1>{session && <div><p>{session.user.name} · {session.user.role}</p><small>Your user ID: {session.user._id}</small><button onClick={logout}>Sign out</button></div>}</header>
    {error && <div className="error" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>}
    {!session && <AuthForm api={api} onSession={value => { setSession(value); setError(''); setTab('notes'); }} onError={onError} />}
    <nav aria-label="Main navigation">{[['posts', 'Public posts'], ...(session ? [['notes', 'My notes']] : []), ...(session?.user.role === 'admin' ? [['users', 'Users'], ['all-notes', 'All notes'], ['interests', 'Interest groups']] : [])].map(([value, label]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setError(''); }}>{label}</button>)}</nav>
    {tab === 'posts' && <Posts api={api} signedIn={!!session} onError={onError} />}
    {session && tab === 'notes' && <Notes key="own" api={api} all={false} onError={onError} />}
    {session?.user.role === 'admin' && tab === 'all-notes' && <Notes key="all" api={api} all onError={onError} />}
    {session?.user.role === 'admin' && tab === 'users' && <Users api={api} selfId={session.user._id} onError={onError} />}
    {session?.user.role === 'admin' && tab === 'interests' && <InterestGroups api={api} onError={onError} />}
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
