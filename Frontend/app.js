const fileInput = document.getElementById("fileInput");
const fastaText = document.getElementById("fastaText");
const loadSampleBtn = document.getElementById("loadSample");
const runBtn = document.getElementById("runBtn");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const msaView = document.getElementById("msaView");
const matrixView = document.getElementById("matrixView");
const treeView = document.getElementById("treeView");
const newickText = document.getElementById("newickText");
const dlAligned = document.getElementById("dlAligned");
const dlMatrix = document.getElementById("dlMatrix");
const dlTree = document.getElementById("dlTree");
const dlSummary = document.getElementById("dlSummary");
const colorScheme = document.getElementById("colorScheme");
const blockSizeInput = document.getElementById("blockSize");
const showConsensusInput = document.getElementById("showConsensus");
const msaLegend = document.getElementById("msaLegend");

let currentAlignment = null;

const SCHEMES = {
  dna: {
    label: "DNA Classic",
    colors: {
      A: "#9bbcff",
      C: "#ffb1a8",
      G: "#ffc48a",
      T: "#7aff7a",
      N: "#c9c9c9",
      "-": "#1b1f2a",
    },
  },
  mono: {
    label: "Monochrome",
    colors: {
      A: "#1b1f2a",
      C: "#1b1f2a",
      G: "#1b1f2a",
      T: "#1b1f2a",
      N: "#1b1f2a",
      "-": "#1b1f2a",
    },
  },
};

const sampleFasta = `>seq1
ACGTACGT
>seq2
ACGTCGTT
>seq3
ACGTTCGT
`;

function parseFasta(text, options = {}) {
  const allowGap = options.allowGap === true;
  const ids = [];
  const seqs = [];
  let currentId = null;
  let current = [];

  const flush = () => {
    if (currentId) {
      const seq = current.join("");
      if (seq.length > 0) {
        ids.push(currentId);
        seqs.push(seq);
      }
    }
    currentId = null;
    current = [];
  };

  const errors = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .forEach((line) => {
      if (line.startsWith(">")) {
        flush();
        currentId = line.slice(1).trim();
        if (!currentId) errors.push("Missing FASTA id");
      } else {
        for (const ch of line) {
          if (ch === " " || ch === "\t") continue;
          const up = ch.toUpperCase();
          if (!["A", "C", "G", "T", "N"].includes(up) && !(allowGap && up === "-")) {
            errors.push(`Invalid character: ${up}`);
          } else {
            current.push(up);
          }
        }
      }
    });

  flush();
  if (ids.length < 2) errors.push("Need at least 2 sequences");
  return { ids, seqs, errors };
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#ff6b6b" : "#b4b8c2";
}

function renderSummary(ids, lengths) {
  if (!ids.length) {
    summaryEl.textContent = "No data.";
    return;
  }
  summaryEl.innerHTML = `Sequences: <b>${ids.length}</b><br />Lengths: ${lengths.join(", ")}`;
}

function resetDownloads() {
  [dlAligned, dlMatrix, dlTree, dlSummary].forEach((link) => {
    link.href = "#";
    link.removeAttribute("download");
  });
}

function clearResults() {
  currentAlignment = null;
  msaView.textContent = "Chưa có kết quả alignment.";
  matrixView.textContent = "Chưa có distance matrix.";
  treeView.textContent = "Chưa có phylogenetic tree.";
  newickText.textContent = "Chưa có dữ liệu.";
}

function canPreviewAlignment(seqs) {
  if (!seqs.length) return false;
  const len = seqs[0].length;
  return seqs.every((seq) => seq.length === len);
}

function renderLegend(schemeKey) {
  const scheme = SCHEMES[schemeKey] || SCHEMES.dna;
  msaLegend.innerHTML = "";
  Object.entries(scheme.colors).forEach(([base, color]) => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = color;

    const label = document.createElement("span");
    label.textContent = base === "-" ? "gap" : base;

    item.appendChild(swatch);
    item.appendChild(label);
    msaLegend.appendChild(item);
  });
}

function renderAlignment(ids, seqs) {
  if (!ids.length || !seqs.length) {
    msaView.textContent = "Chưa có kết quả alignment.";
    return;
  }

  currentAlignment = { ids, seqs };

  const blockSize = Math.max(20, Math.min(120, Number(blockSizeInput.value) || 60));
  blockSizeInput.value = blockSize;

  const showConsensus = showConsensusInput.checked;
  const schemeKey = colorScheme.value;

  msaView.classList.toggle("scheme-mono", schemeKey === "mono");
  renderLegend(schemeKey);

  const L = seqs[0].length;
  msaView.innerHTML = "";

  for (let start = 0; start < L; start += blockSize) {
    const end = Math.min(L, start + blockSize);
    const table = document.createElement("table");
    table.className = "msa-table";

    const header = document.createElement("tr");
    const headLabel = document.createElement("th");
    headLabel.className = "msa-id";
    headLabel.textContent = `Pos ${start + 1}-${end}`;
    header.appendChild(headLabel);

    for (let i = start; i < end; i++) {
      const th = document.createElement("th");
      th.textContent = (i + 1) % 10 === 0 ? i + 1 : "";
      header.appendChild(th);
    }

    table.appendChild(header);

    for (let r = 0; r < ids.length; r++) {
      const tr = document.createElement("tr");
      const idCell = document.createElement("td");
      idCell.className = "msa-id";
      idCell.textContent = ids[r];
      tr.appendChild(idCell);

      const seq = seqs[r];
      for (let c = start; c < end; c++) {
        const base = seq[c] || "-";
        const td = document.createElement("td");
        td.textContent = base;
        td.className = `base-${base === "-" ? "gap" : base}`;
        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    if (showConsensus) {
      const tr = document.createElement("tr");
      const idCell = document.createElement("td");
      idCell.className = "msa-id msa-consensus";
      idCell.textContent = "Consensus";
      tr.appendChild(idCell);

      for (let c = start; c < end; c++) {
        const chars = new Set();
        for (let s = 0; s < seqs.length; s++) {
          const base = seqs[s][c];
          if (base && base !== "-") chars.add(base);
        }
        const td = document.createElement("td");
        td.className = "msa-consensus";
        td.textContent = chars.size === 1 ? "*" : " ";
        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    msaView.appendChild(table);
  }
}

function runPreview() {
  const parsed = parseFasta(fastaText.value);

  if (parsed.errors.length) {
    clearResults();
    setStatus(parsed.errors.join("; "), true);
    return;
  }

  renderSummary(parsed.ids, parsed.seqs.map((s) => s.length));

  if (canPreviewAlignment(parsed.seqs)) {
    renderAlignment(parsed.ids, parsed.seqs);

  } else {
    currentAlignment = null;
    msaView.textContent =
      renderLegend(colorScheme.value);
  }

  matrixView.textContent = "Chưa có distance matrix.";
  treeView.textContent = "Chưa có phylogenetic tree.";
  newickText.textContent = "Chưa có dữ liệu.";
  resetDownloads();
}

fileInput.addEventListener("change", async () => {
  if (!fileInput.files[0]) return;

  const text = await fileInput.files[0].text();
  fastaText.value = text.trim();

  const parsed = parseFasta(fastaText.value);
  clearResults();

  if (parsed.errors.length) {
    setStatus(parsed.errors.join("; "), true);
  } else {
    renderSummary(parsed.ids, parsed.seqs.map((s) => s.length));
    setStatus("FASTA loaded");
  }
});

loadSampleBtn.addEventListener("click", () => {
  fastaText.value = sampleFasta.trim();
  const parsed = parseFasta(fastaText.value);
  clearResults();

  if (parsed.errors.length) {
    setStatus(parsed.errors.join("; "), true);
  } else {
    renderSummary(parsed.ids, parsed.seqs.map((s) => s.length));
    setStatus("Sample loaded");
  }
});

colorScheme.addEventListener("change", () => {
  renderLegend(colorScheme.value);
  if (currentAlignment) renderAlignment(currentAlignment.ids, currentAlignment.seqs);
});

blockSizeInput.addEventListener("change", () => {
  if (currentAlignment) renderAlignment(currentAlignment.ids, currentAlignment.seqs);
});

showConsensusInput.addEventListener("change", () => {
  if (currentAlignment) renderAlignment(currentAlignment.ids, currentAlignment.seqs);
});

runBtn.addEventListener("click", runPreview);

renderLegend(colorScheme.value);
clearResults();
resetDownloads();
setStatus("");