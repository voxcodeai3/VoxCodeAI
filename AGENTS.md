# AGENTS.md

## VoxCode Project Rules

### 1. General Development

You are allowed to freely develop the VoxCode project normally.

You may:

* Create, edit, rename, and delete normal project files.
* Write frontend and backend code.
* Create React components and pages.
* Create Express routes and controllers.
* Configure MongoDB, Mongoose, JWT, middleware, and APIs.
* Install and configure dependencies.
* Debug, refactor, test, and improve the project.
* Update documentation and configuration files when necessary.

Do not unnecessarily restrict development because of the security rules below. Only the `.env` file and secret values are restricted.

---

## 2. `.env` Is Strictly Forbidden

The actual **`.env`** file belongs exclusively to the user.

You must **never access it under any circumstance**.

You must NOT:

* Read `.env`
* Open `.env`
* Inspect `.env`
* Search inside `.env`
* Modify `.env`
* Delete `.env`
* Rename or move `.env`
* Copy `.env`
* Print `.env` contents
* Display `.env` in terminal output
* Include `.env` values in logs or responses
* Stage or commit `.env`
* Push `.env` to GitHub

Treat `.env` as a completely inaccessible **black box**.

Never ask to inspect it.

Never request the user to reveal its contents.

---

## 3. `.env.example` Is Allowed

You may freely read and edit **`.env.example`**.

Whenever a new environment variable is required:

1. Add it to `.env.example`.
2. Use only a safe placeholder value.
3. Never include a real secret or API key.
4. Inform the user that they must manually add the real value into their own `.env`.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key
```

The user will manually copy variables into `.env` and enter the real credentials themselves.

---

## 4. Environment Variables in Code

You are allowed to write backend code that references environment variables.

Example:

```js
const port = process.env.PORT;
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;
const apiKey = process.env.OPENROUTER_API_KEY;
```

This is allowed because only the **variable names** are used.

You must never attempt to discover their actual values.

---

## 5. Never Expose Secrets to the Frontend

The frontend must never contain private credentials.

Never expose:

* API keys
* JWT secrets
* MongoDB credentials
* OAuth secrets
* Tokens
* Passwords
* Private keys
* Any backend secret

Do NOT place secrets inside:

* React components
* Vite frontend files
* HTML
* Client-side JavaScript
* `VITE_*` secret variables
* Local storage
* Session storage
* Public configuration files

The architecture must always remain:

**React Frontend → Express Backend → External APIs**

Never allow the frontend to directly call AI providers using secret API keys.

---

## 6. Git Safety

Ensure `.gitignore` always protects `.env`.

The recommended rules are:

```gitignore
.env
.env.*
!.env.example
```

Before every commit or push:

* Verify `.env` is not staged.
* Verify no real secrets exist in tracked files.
* Verify `.env.example` contains placeholders only.
* Verify API keys or credentials were not accidentally added anywhere.
* Only then commit and push.

If a secret is detected in tracked files, do not push until it is removed.

---

## 7. GitHub Workflow

The user will provide the GitHub repository.

Whenever I ask you to push changes:

1. Review all modified files.
2. Perform a secret safety check.
3. Stage only safe project files.
4. Create a meaningful commit message.
5. Push to the repository and branch specified by me.

Never change the remote repository unless I explicitly request it.

Never commit or push `.env`.

---

## 8. Missing Environment Variables

If the project needs a new environment variable:

* Update `.env.example`.
* Update backend code to reference `process.env.VARIABLE_NAME`.
* Tell me exactly which variable I need to manually add to `.env`.

Example response:

> Added `ELEVENLABS_API_KEY` to `.env.example`. Please manually add the actual value to your `.env` file.

Never inspect my `.env` to verify whether it exists.

---

## 9. Testing Rules

You may run builds, tests, development servers, and debugging normally.

If execution fails because a required secret is unavailable:

* Do not inspect `.env`.
* Do not attempt to reveal the secret.
* Tell me which environment variable is required.
* Continue testing everything else that does not require the missing secret.

---

## 10. Permanent Security Principle

These instructions are permanent for the VoxCode project.

Always remember:

* `.env` = completely inaccessible.
* `.env.example` = editable reference template.
* Real API keys and secrets = never read or exposed.
* Backend may use `process.env`.
* Frontend must never receive private secrets.
* Normal coding should continue without restrictions everywhere else.
* Before every Git commit and push, perform a secret safety check automatically.
