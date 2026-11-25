export default function Placeholder({ title }: { title: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">WORKSPACE / CONFIGURATION</div>
          <h1>{title}</h1>
          <p>
            This module is included in the navigation. Configure the database and
            use the supported workflows as they are enabled.
          </p>
        </div>
      </div>
      <div className="panel">
        <h2>{title} workspace</h2>
        <p className="muted">
          This starter provides the single-shop application shell and database
          foundation. Advanced workflows such as FIFO cost allocation, barcode label
          printing, camera scanning, multi-technician time logs, returns, and
          offline synchronization require further implementation and testing
          before production use.
        </p>
      </div>
    </>
  );
}

