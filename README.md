# Industrial controls with C#, OpenClaw.NET and AgentQi Companion

A standalone English course on industrial controls, with a local article library and runnable C# study labs. Learn how device signals become useful observations, how supervisory applications handle failures, and how an agent can work with bounded industrial tools.

## Read offline

Download this repository using **Code → Download ZIP**, extract it, then open either of these files in your browser:

- [`english-articles/index.html`](english-articles/index.html): searchable library of 12 English study editions, with individual HTML and plain-text copies.
- [`Industrial-Controls-Tutorial.html`](Industrial-Controls-Tutorial.html): the comprehensive handbook, including 17 chapters, 14 guided labs, worked examples, answers, an eight-week study plan and five appendices.

For one continuous document, open [`english-articles/all-articles.html`](english-articles/all-articles.html) or read the [combined plain-text edition](english-articles/all-articles.txt). A ready-to-extract [study pack](Industrial-Controls-Expanded-English-Pack.zip) is also included.

All lesson text is local. CNBlogs and other external links provide attribution and optional further reading; users do not need to visit them to follow the English course. GitHub displays HTML source, so download the files to read the formatted pages.

## What is included

- Industrial software boundaries, PLC scans, timing and data quality.
- Modbus TCP, OPC UA and MQTT concepts; byte order, packed bits and TCP framing.
- Acquisition, storage, alarms, operator interfaces and recoverable workflows.
- A simulated tank, Modbus device and poller, scan simulation, alarm and outbox exercises, a console dashboard and historian SQL exercises.
- C# MCP tools and configuration guidance for [OpenClaw.NET](https://github.com/clawdotnet/openclaw.net), with AgentQi Companion as the desktop interface.

## Run the labs

Reading requires only a browser. The C# labs require the **.NET 10 SDK** and access to NuGet for the first restore. The Python checks use the Python 3 standard library.

From the repository folder:

```powershell
dotnet run --project ./labs/IndustrialLab -- --self-test
dotnet run --project ./labs/IndustrialLab -- --modbus
```

The self-test should finish with `All 85 checks passed.` The second command keeps the simulator running, with HTTP at `http://localhost:5088`, MCP at `/mcp`, and the simulated Modbus TCP device at `127.0.0.1:5502`. Stop it with Ctrl+C.

In another terminal, try the poller:

```powershell
dotnet run --project ./labs/IndustrialLab -- --poll --count 10
```

Follow [`START-HERE.txt`](START-HERE.txt) and Appendix C of the handbook for the complete lab sequence. [`VERIFICATION.txt`](VERIFICATION.txt) records the checks performed and their limits.

The simulator runs locally and has no connection to physical equipment. Its MCP proposals never execute a setpoint change. The OpenClaw.NET configuration example is a fragment to merge into a separately configured gateway; the complete gateway and Companion integration has not been tested here.

## Sources and attribution

The reading map covers nine articles in Wackysoft's original industrial-controls series and three subsequent troubleshooting articles, starting with [the CNBlogs series entry](https://www.cnblogs.com/wackysoft/p/22144512).

The English editions contain brief source summaries and independently written expanded lessons. They are **not full translations** of the original articles. [`sources.json`](sources.json) identifies every source article and the primary technical references. Original articles and source images are not redistributed in this repository.

OpenClaw.NET-specific guidance was checked against commit `603b567646423a8090a16836aa155f9b011aaa00` on 29 September 2026. The proposed industrial product features are distinguished from existing runtime capabilities. This is an independent study resource.
