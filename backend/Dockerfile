FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY CoDesk.sln ./
COPY src/CoDesk.Api/CoDesk.Api.csproj src/CoDesk.Api/
COPY src/CoDesk.Application/CoDesk.Application.csproj src/CoDesk.Application/
COPY src/CoDesk.Domain/CoDesk.Domain.csproj src/CoDesk.Domain/
COPY src/CoDesk.Infrastructure/CoDesk.Infrastructure.csproj src/CoDesk.Infrastructure/
RUN dotnet restore src/CoDesk.Api/CoDesk.Api.csproj

COPY . .
RUN dotnet publish src/CoDesk.Api/CoDesk.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000

ENTRYPOINT ["dotnet", "CoDesk.Api.dll"]
