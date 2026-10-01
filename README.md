# Industrial controls with C#, OpenClaw.NET and AgentQi Companion

A standalone English course on industrial controls, with a local article library, runnable C# study labs and an interactive website. Learn how device signals become useful observations, how supervisory applications handle failures, and how an agent can work with bounded industrial tools.

The course builds on Wackysoft's .NET industrial-controls article series; see [Sources and attribution](#sources-and-attribution).

## Read offline

Download this repository using **Code → Download ZIP**, extract it, then open either of these files in your browser:

- [`english-articles/index.html`](english-articles/index.html): searchable library of 12 English study editions, with individual HTML and plain-text copies.
- [`Industrial-Controls-Tutorial.html`](Industrial-Controls-Tutorial.html): the comprehensive handbook, including 17 chapters, 14 guided labs, worked examples, answers, an eight-week study plan and six appendices.

For one continuous document, open [`english-articles/all-articles.html`](english-articles/all-articles.html) or read the [combined plain-text edition](english-articles/all-articles.txt). A ready-to-extract [study pack](Industrial-Controls-Expanded-English-Pack.zip) is also included.

All lesson text is local. External links are references and optional further reading; you don't need them to follow the course. GitHub displays HTML source, so download the files to read the formatted pages.

## Interactive labs

[`web/`](web/) is a React site with 13 browser labs (scan cycles, byte order, framing, alarms, ladder logic, analog scaling and more) plus the tutorials. See [`web/README.md`](web/README.md) to run or build it.

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

The course builds on nine articles in Wackysoft's Chinese-language .NET industrial-controls series and three later troubleshooting articles by the same author, starting with [the series entry on CNBlogs](https://www.cnblogs.com/wackysoft/p/22144512). Thanks to the author for a practical, well-structured series.

The English editions are independently written lessons. They are **not translations** of the original articles. Each lesson credits its source article, with a short summary, in its References section; the handbook lists all twelve in Appendix F. [`sources.json`](sources.json) identifies every source article and the primary technical references. Original articles and source images are not redistributed in this repository.

OpenClaw.NET-specific guidance was checked against commit `603b567646423a8090a16836aa155f9b011aaa00` on 29 September 2026. The proposed industrial product features are distinguished from existing runtime capabilities. This is an independent study resource.
