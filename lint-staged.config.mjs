import path from "path";

/** Run ESLint from frontend/ so flat config and Next paths resolve. */
export default {
  "frontend/**/*.{ts,tsx,js,jsx}": (filenames) => {
    const relative = filenames
      .map((file) => {
        const rel = path.relative("frontend", file).split(path.sep).join("/");
        return `'${rel.replace(/'/g, `'\\''`)}'`;
      })
      .join(" ");
    return `sh -c "cd frontend && npx eslint --max-warnings=0 --fix ${relative}"`;
  },
};
