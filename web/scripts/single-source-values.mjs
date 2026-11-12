import path from "node:path";
import ts from "typescript";

export function registrations(files) {
  return [...files].filter(([file]) => file.endsWith(".single-source.json"))
    .flatMap(([, source]) => JSON.parse(source));
}

function syntax(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

function visit(node, inspect) {
  inspect(node);
  ts.forEachChild(node, (child) => visit(child, inspect));
}

function checkNode(files, entry, report) {
  const value = files.get(entry.owner.file)?.trim();
  if (entry.owner.selector !== "semver" || !/^\d+\.\d+\.\d+$/.test(value ?? "")) {
    report(entry.owner.file, 1, "missing or invalid semver owner");
  }
  // Match the selection context, not the current version: stale/new pins fail too.
  const selection = /(?:node-version\s*:|\bnode(?:js)?_?version\s*[:=]|(?<![\w-])node@|\bFROM\s+node:|\b(?:nvm|fnm)\s+(?:install|use)\s+|\bnodejs\s+|\bNode(?:\.js)?(?:\s+is)?\s+\**[v~^]?)([\s"'`]*[v~^]?\d+(?:\.\d+){0,2}(?:\.x)?)/gi;
  for (const [file, source] of files) {
    if (file === entry.owner.file) continue;
    if ([".nvmrc", ".node-version"].includes(path.posix.basename(file))) {
      report(file, 1, "independent Node version file");
    }
    if (file.endsWith("package.json")) {
      const metadata = JSON.parse(source);
      if (metadata.engines?.node || metadata.volta?.node) report(file, 1, "derive Node tooling selection from the owner");
    }
    let region;
    for (const [offset, line] of source.split("\n").entries()) {
      const marker = line.match(/^\s*\/\/ single-source-adversarial-(begin|end): ([\w-]+)\s*$/);
      if (marker) {
        const allowed = entry.adversarial?.some((item) => item.file === file && item.region === marker[2]);
        if (!allowed || (marker[1] === "begin" ? region : region !== marker[2])) {
          report(file, offset + 1, "unregistered or overlapping adversarial region");
        }
        region = marker[1] === "begin" && allowed ? marker[2] : undefined;
        continue;
      }
      if (region) continue;
      for (const match of line.matchAll(selection)) report(file, offset + 1, `handwritten Node selection ${match[0].trim()}`);
      if (/\.ya?ml$/.test(file) && /^\s*node-version\s*:/.test(line)) report(file, offset + 1, "setup-node must use the version file, including for matrix builds");
      if (/\.ya?ml$/.test(file) && /^\s*node-version-file\s*:/.test(line) && !new RegExp(`node-version-file:\\s*["']?${entry.owner.file.replaceAll(".", "\\.")}["']?\\s*$`).test(line)) {
        report(file, offset + 1, `version file must be ${entry.owner.file}`);
      }
    }
    if (region) report(file, source.split("\n").length, "unterminated adversarial region");
  }
  for (const consumer of entry.consumers) {
    const source = files.get(consumer.file) ?? "";
    if (consumer.selector === "setup-node") {
      const steps = source.split(/(?=^\s*- uses:)/m).filter((step) => /uses: actions\/setup-node@/.test(step));
      if (!steps.length || steps.some((step) => !step.includes(`node-version-file: ${entry.owner.file}`))) {
        report(consumer.file, 1, "setup-node must read the owner via node-version-file");
      }
    } else if (consumer.selector === "runtime-check") {
      // Verify the executable reader, not a marker claiming it was generated.
      const ast = syntax(consumer.file, source);
      let readsOwner = false;
      visit(ast, (node) => {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "readFileSync"
          && ts.isNewExpression(node.arguments[0]) && node.arguments[0].expression.getText(ast) === "URL"
          && ts.isStringLiteral(node.arguments[0].arguments?.[0])) {
          readsOwner ||= path.posix.normalize(path.posix.join(path.posix.dirname(consumer.file), node.arguments[0].arguments[0].text)) === entry.owner.file;
        }
      });
      if (!readsOwner) report(consumer.file, 1, "runtime check must read the owner");
    } else if (consumer.selector === "preinstall") {
      const checker = entry.consumers.find((item) => item.selector === "runtime-check");
      const relative = checker && path.posix.relative(path.posix.dirname(consumer.file), checker.file);
      if (JSON.parse(source || "{}").scripts?.preinstall !== `node ${relative}`) report(consumer.file, 1, "preinstall must run the owner-reading runtime check");
    } else report(consumer.file, 1, `unknown consumer selector ${consumer.selector}`);
  }
}

function checkMemory(files, entry, report) {
  let owners = 0;
  let projections = 0;
  for (const [file, source] of files) {
    if (!/\.(?:[cm]?js|tsx?)$/.test(file)) continue;
    const ast = syntax(file, source);
    visit(ast, (node) => {
      if (file === entry.owner.file && ts.isFunctionDeclaration(node) && node.name?.text === entry.owner.selector) owners++;
      const field = ts.isPropertyAccessExpression(node) ? node.name.text
        : ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : undefined;
      if (field !== "peak_bytes" && field !== "reserve_bytes") return;
      // Constructing fixture/input data is not an independent policy reader.
      if (ts.isBinaryExpression(node.parent) && node.parent.left === node
        && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) return;
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      let scope = node.parent;
      while (scope && !ts.isFunctionDeclaration(scope)) scope = scope.parent;
      if (file !== entry.owner.file || scope?.name?.text !== entry.owner.selector) {
        report(file, line, `independent memory projection reads ${field}`);
      } else if (field === "reserve_bytes") {
        report(file, line, "reserve is informational; project peak only");
      } else {
        projections++;
        // The sole projection must use the contract field directly, with no arithmetic.
        const declaration = node.parent;
        if (!ts.isVariableDeclaration(declaration) || declaration.initializer !== node) {
          report(file, line, "project peak_bytes directly into a variable");
        }
      }
    });
  }
  if (owners !== 1) report(entry.owner.file, 1, `expected the single function owner ${entry.owner.selector}`);
  if (projections !== 1) report(entry.owner.file, 1, "expected exactly one peak_bytes projection in the owner");
}

function checkContractVersions(files, entry, report) {
  let owner;
  try { owner = JSON.parse(files.get(entry.owner.file) ?? ""); } catch { owner = undefined; }
  for (const key of ["major"]) {
    if (!Number.isInteger(owner?.[key])) report(entry.owner.file, 1, `owner must hold an integer ${key}`);
  }
  const numeric = (node) => node && ts.isNumericLiteral(node);
  const comparison = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
  ]);
  // Match the leaf name only: property name, callee name, or the indexed object.
  const versionName = /^semver$|(?:major|contract_?version|schema_?version)$/i;
  const leaf = (expression) => {
    if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression) || ts.isAsExpression(expression)) return leaf(expression.expression);
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (ts.isCallExpression(expression)) return leaf(expression.expression);
    if (ts.isElementAccessExpression(expression)) return ts.isStringLiteralLike(expression.argumentExpression) ? expression.argumentExpression.text : leaf(expression.expression);
    return ts.isIdentifier(expression) ? expression.text : "";
  };
  for (const [file, text] of files) {
    if (file === entry.owner.file || !/^web\/(?:src|scripts)\/.*\.(?:[cm]?js|tsx?)$/.test(file) || /\.test\.[cm]?[jt]sx?$/.test(file)) continue;
    const ast = syntax(file, text);
    visit(ast, (node) => {
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      const flag = (what) => report(file, line, `${what}; read it from ${entry.owner.file}`);
      // A named contract major/version (or MAJOR) initialised with a number.
      if ((ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) && numeric(node.initializer)
        && versionName.test(node.name.getText(ast))) flag(`${node.name.getText(ast)} initialised with a literal`);
      // A type literal such as `schema_version: 2`.
      if (ts.isPropertySignature(node) && node.type && ts.isLiteralTypeNode(node.type) && numeric(node.type.literal)
        && /^(?:schema_version|major)$/.test(node.name.getText(ast))) flag(`${node.name.getText(ast)} typed as a literal`);
      // Equality or relational comparison of a version-like expression with a number.
      if (ts.isBinaryExpression(node) && comparison.has(node.operatorToken.kind)) {
        for (const [side, other] of [[node.left, node.right], [node.right, node.left]]) {
          if (numeric(other) && versionName.test(leaf(side))) flag(`${side.getText(ast)} compared with a literal`);
        }
      }
      if (ts.isCaseClause(node) && numeric(node.expression) && versionName.test(leaf(node.parent.parent.expression))) flag("version switch on a literal case");
      // A tag regex that fixes a major, such as /^v3\./.
      if (ts.isRegularExpressionLiteral(node) && /^\/\^v\d/.test(node.text)) flag(`tag regex ${node.text} fixes a major`);
    });
  }
}

// The capability names and status strings are the release vocabulary's (CatalogIndex.vocabulary).
// The owner file holds a real copy of it (the test fixture); no other site source may write one
// as a string, so labels, groupings and meanings cannot be typed here.
function checkPublishedVocabulary(files, entry, report) {
  const ownerSource = files.get(entry.owner.file) ?? "";
  const ownerAst = syntax(entry.owner.file, ownerSource);
  const values = new Set();
  const named = (node) => ts.isPropertyAssignment(node) ? node.name.getText(ownerAst).replace(/^["']|["']$/g, "") : undefined;
  visit(ownerAst, (node) => {
    if (named(node) !== entry.owner.selector || !ts.isObjectLiteralExpression(node.initializer)) return;
    visit(node.initializer, (inner) => {
      if (["name", "status"].includes(named(inner)) && ts.isStringLiteral(inner.initializer)) values.add(inner.initializer.text);
    });
  });
  if (values.size === 0) {
    report(entry.owner.file, 1, `expected a ${entry.owner.selector} object with capability names and statuses`);
    return;
  }
  for (const [file, text] of files) {
    if (file === entry.owner.file || !/^web\/src\/.*\.(?:tsx?)$/.test(file) || /\.(?:test|fixture|d)\.tsx?$/.test(file)) continue;
    const ast = syntax(file, text);
    visit(ast, (node) => {
      // String, template (with or without substitutions) and JSX text forms.
      const written = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)
        || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.text
        : ts.isJsxText(node) ? node.text.trim() : undefined;
      if (written === undefined || !values.has(written)) return;
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      report(file, line, `read ${JSON.stringify(written)} from the release vocabulary instead of writing it`);
    });
  }
}

export function checkSingleSources(files, entries = registrations(files)) {
  const errors = [];
  const ids = new Set();
  const owners = new Set();
  const classes = new Set();
  const kinds = { "node-version": checkNode, "memory-projection": checkMemory, "contract-versions": checkContractVersions, "published-vocabulary": checkPublishedVocabulary };
  for (const entry of entries) {
    const owner = `${entry.owner?.file}#${entry.owner?.selector}`;
    const report = (file, line, detail) => errors.push(`${entry.id}: ${file}:${line}: ${detail}; owner ${owner}; ${entry.derive}`);
    if (!entry.id || !entry.owner?.file || !entry.owner?.selector || !entry.derive || !files.has(entry.owner.file)) {
      report(entry.owner?.file, 1, "missing owner selector or derivation");
      continue;
    }
    if (ids.has(entry.id) || owners.has(owner) || classes.has(entry.kind)) report(entry.owner.file, 1, "duplicate or overlapping owner registration");
    ids.add(entry.id);
    owners.add(owner);
    classes.add(entry.kind);
    const check = kinds[entry.kind];
    if (!check) report(entry.owner.file, 1, `unregistered class ${entry.kind}`);
    else check(files, entry, report);
  }
  return errors;
}
