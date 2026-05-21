"""
Climactix AI — RAG Ingestion CLI

Ingest climate documents into the vector store from the command line.

Usage:
    # Ingest a single PDF
    python scripts/ingest.py data/ipcc_ar6_spm.pdf

    # Ingest a text file into a specific collection
    python scripts/ingest.py data/tcfd_guidance.txt --collection regulatory_frameworks

    # Ingest with metadata tags
    python scripts/ingest.py data/shell_2023_esg.pdf --collection company_disclosures --type "ESG Report" --year 2023

    # Ingest all PDFs in data/
    python scripts/ingest.py --directory data/
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.retrieval.qdrant_client import vector_store
from app.ingestion.pipeline import ingest_file, ingest_directory
from app.utils.logger import logger


async def run(args: argparse.Namespace) -> None:
    # Connect to Qdrant
    ok = vector_store.connect()
    if not ok:
        print("\nERROR: Cannot connect to Qdrant.")
        print("Start it with:  docker compose up qdrant -d\n")
        sys.exit(1)

    metadata: dict = {}
    if args.type:
        metadata["document_type"] = args.type
    if args.year:
        metadata["year"] = args.year

    if args.directory:
        print(f"\nIngesting all {args.glob} files from: {args.directory}")
        results = await ingest_directory(
            args.directory,
            collection=args.collection,
            glob=args.glob,
            metadata=metadata or None,
        )
        print(f"\nResults:")
        for fname, count in results.items():
            status = f"{count} chunks" if count > 0 else "FAILED"
            print(f"  {fname}: {status}")
        total = sum(v for v in results.values() if v > 0)
        print(f"\nTotal: {total} chunks ingested across {len(results)} files\n")

    elif args.file:
        if not Path(args.file).exists():
            print(f"\nERROR: File not found: {args.file}\n")
            sys.exit(1)

        print(f"\nIngesting: {args.file}")
        print(f"Collection: {args.collection}")
        if metadata:
            print(f"Metadata: {metadata}")
        print()

        count = await ingest_file(
            args.file,
            collection=args.collection,
            metadata=metadata or None,
        )
        print(f"\nDone. {count} chunks ingested into '{args.collection}'\n")

    else:
        print("Provide a file path or --directory. Run with --help for usage.")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Climactix AI — RAG Document Ingestion CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("file", nargs="?", help="Path to a .pdf, .txt, or .md file")
    parser.add_argument(
        "--directory", "-d",
        help="Ingest all matching files in this directory",
    )
    parser.add_argument(
        "--collection", "-c",
        default="esg_documents",
        choices=["esg_documents", "climate_reports", "regulatory_frameworks", "company_disclosures"],
        help="Target Qdrant collection (default: esg_documents)",
    )
    parser.add_argument("--glob", default="*.pdf", help="File glob for --directory mode (default: *.pdf)")
    parser.add_argument("--type", help="Document type tag e.g. 'TCFD report'")
    parser.add_argument("--year", help="Publication year e.g. '2023'")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
