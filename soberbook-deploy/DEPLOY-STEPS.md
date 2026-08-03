# Putting Sober Book online — no Terminal required

Everything here is browser clicking. Two free accounts, then a real URL that works on your phone.

**This folder is safe to upload publicly.** No keys, no salt, no `.env`. I checked. The two secret values get typed into Vercel in step 9, where they stay private.

---

## Part 1 — GitHub (a place to keep the code)

**1.** Go to **github.com** → **Sign up**. Free.

**2.** Once you're in, click the **+** at the top right → **New repository**.

**3.** Name it `soberbook`. Leave it **Public** (fine — there are no secrets in here). Don't tick "Add a README". Click **Create repository**.

**4.** On the next page, click the link **"uploading an existing file"**.

**5.** Open the `soberbook-deploy` folder in Finder, select **everything inside it** (Cmd+A) and **drag it into the browser window**.

> ⚠️ Drag the *contents*, not the folder itself. You want `app`, `lib`, `package.json` and so on at the top level of the repo — not nested inside another folder.

**6.** Scroll down, click **Commit changes**.

---

## Part 2 — Vercel (the thing that runs it)

**7.** Go to **vercel.com** → **Sign up** → choose **Continue with GitHub**. It'll ask permission to see your repos — that's expected, say yes.

**8.** On your Vercel dashboard, click **Add New → Project**. Your `soberbook` repo appears in the list. Click **Import**.

**9.** ⚠️ **Before clicking Deploy**, expand **Environment Variables** and add these two. This is the step everybody skips, and skipping it means the app builds fine and then can't talk to the database.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://sggizsfqbnqjerubcfly.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_zXwCKJacZKRrguqAP0ctHw_IWWIFwWo` |

**10.** Click **Deploy**. Two or three minutes.

You'll get a URL like `soberbook-something.vercel.app`. **That's the app.** Open it on your phone.

---

## Then

Create an account → pick a handle → the Wall opens empty. Put something up.

That post goes into the Postgres database in Ohio, through the anonymity views, and it'll still be there tomorrow. That's the difference between this and the prototype.

---

## If something goes wrong

**Build fails on Vercel** — open the build log, copy the red text, paste it to me.

**App loads but signing up errors** — almost always the environment variables. Vercel → your project → Settings → Environment Variables. Check for a stray space or a missing character, then Deployments → ⋯ → Redeploy.

**"Invalid API key"** — same cause, same fix.

---

## One thing to change later, not now

Supabase sends a confirmation email on sign-up, and by default it links back to `localhost:3000`. Once you have the Vercel URL:

**Supabase → Authentication → URL Configuration → Site URL** → paste your Vercel URL.

Until then, confirmation links will point at a server that isn't running. Not urgent — but it'll confuse the first person you invite, so do it before you send the link to anyone.
