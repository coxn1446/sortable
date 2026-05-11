import React, { useEffect, useId, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';

import { setUser } from '../../store/auth.reducer';
import { updateMe } from '../../helpers/userHelpers';
import { uploadFile } from '../../helpers/uploadHelpers';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ProfileAvatar from '../ui/ProfileAvatar';
import LoginSettingsModal from './LoginSettingsModal';

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight';

const sectionLabelClass =
  'text-xs font-medium uppercase tracking-wide text-sortable-text-secondary';

export default function ProfileAccountSection({ user }) {
  const dispatch = useDispatch();
  const fileInputId = useId();
  const fileRef = useRef(null);

  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture ?? null);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [loginSettingsOpen, setLoginSettingsOpen] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? '');
    setEmail(user?.email ?? '');
    setProfilePicture(user?.profile_picture ?? null);
    setPendingFile(null);
  }, [user?.user_id, user?.username, user?.email, user?.profile_picture]);

  const dirty =
    username.trim() !== (user?.username ?? '').trim() ||
    (email.trim() || '') !== (user?.email ?? '') ||
    profilePicture !== (user?.profile_picture ?? null) ||
    pendingFile !== null;

  const previewUrl = pendingFile ? URL.createObjectURL(pendingFile) : null;
  const displayPicture = previewUrl || profilePicture;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSave = async () => {
    if (!user?.user_id) return;
    setSaving(true);
    try {
      let pictureUrl = profilePicture;
      if (pendingFile) {
        const up = await uploadFile(pendingFile);
        pictureUrl = up.url;
      }
      const patch = {
        username: username.trim(),
        email: email.trim() || null,
        profile_picture: pictureUrl,
      };
      const next = await updateMe(patch);
      dispatch(setUser(next));
      setProfilePicture(next.profile_picture ?? null);
      setPendingFile(null);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = () => {
    setPendingFile(null);
    setProfilePicture(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—';

  return (
    <>
      <Card className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-2 lg:gap-10">
        <div className="flex flex-col items-center gap-4 border-b border-white/10 pb-8 text-center lg:border-b-0 lg:border-r lg:border-white/10 lg:pb-0 lg:pr-8">
          <ProfileAvatar
            userId={user?.user_id}
            username={user?.username}
            profilePicture={displayPicture}
            size="lg"
          />
          <input
            ref={fileRef}
            id={fileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPendingFile(f || null);
            }}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              {pendingFile || displayPicture ? 'Change photo' : 'Upload photo'}
            </Button>
            {(pendingFile || displayPicture) && (
              <Button type="button" variant="secondary" size="sm" onClick={handleRemovePhoto}>
                Remove photo
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <label htmlFor="profile-username" className={sectionLabelClass}>
              Username
            </label>
            <input
              id="profile-username"
              className={`${fieldClass} mt-1`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              maxLength={64}
            />
          </div>
          <div>
            <label htmlFor="profile-email" className={sectionLabelClass}>
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              className={`${fieldClass} mt-1`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <dt className={sectionLabelClass}>Joined</dt>
            <dd className="mt-1 text-base text-sortable-text-primary">{joined}</dd>
          </div>

          <div className="pt-2">
            <Button type="button" variant="secondary" onClick={() => setLoginSettingsOpen(true)}>
              Log in Settings
            </Button>
          </div>

          {dirty ? (
            <div className="pt-2">
              <Button type="button" onClick={handleSave} disabled={saving || !username.trim()}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <LoginSettingsModal open={loginSettingsOpen} onClose={() => setLoginSettingsOpen(false)} user={user} />
    </>
  );
}
