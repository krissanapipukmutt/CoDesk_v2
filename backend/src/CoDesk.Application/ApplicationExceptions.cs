namespace CoDesk.Application;

public sealed class ConflictException(string message) : Exception(message);
