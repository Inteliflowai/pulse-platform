async function main() {
  const res = await fetch('http://localhost:3000/api/sync/node-jobs/83d92f63-b84f-49b4-a572-9cc3dafe54c7');
  const data: any = await res.json();
  console.log('Jobs returned by API:');
  for (const j of data.jobs) {
    console.log(`  ${j.id} | status=${j.status} | pkg=${j.packages?.name}`);
  }
}
main();
