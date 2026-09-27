namespace GYM.Domain.Exceptions;

/// <summary>A field-level validation message. Field names match API request property names (camelCase).</summary>
public sealed record FieldError(string Field, string Message);

/// <summary>
/// Base for expected, client-safe failures. The message is shown to people as-is,
/// so it must never contain technical details (spec §22).
/// </summary>
public abstract class GymException : Exception
{
    protected GymException(string message, IReadOnlyList<FieldError>? errors = null, object? data = null)
        : base(message)
    {
        Errors = errors ?? [];
        ResponseData = data;
    }

    /// <summary>HTTP status the API should use.</summary>
    public abstract int StatusCode { get; }

    public IReadOnlyList<FieldError> Errors { get; }

    /// <summary>Optional safe payload returned with the error (for example the active workout id).</summary>
    public object? ResponseData { get; }
}

/// <summary>Input failed validation (422).</summary>
public sealed class ValidationException : GymException
{
    public ValidationException(string message, IReadOnlyList<FieldError> errors)
        : base(message, errors)
    {
    }

    public ValidationException(string field, string message)
        : base(message, [new FieldError(field, message)])
    {
    }

    public override int StatusCode => 422;
}

/// <summary>A business rule prevents the operation (422).</summary>
public sealed class BusinessRuleException(string message, IReadOnlyList<FieldError>? errors = null)
    : GymException(message, errors)
{
    public override int StatusCode => 422;
}

/// <summary>The record does not exist or does not belong to the caller (404). Never reveal which.</summary>
public sealed class NotFoundException(string message) : GymException(message)
{
    public override int StatusCode => 404;
}

/// <summary>The request conflicts with current state, e.g. a duplicate or a finished workout (409).</summary>
public sealed class ConflictException(string message, IReadOnlyList<FieldError>? errors = null, object? data = null)
    : GymException(message, errors, data)
{
    public override int StatusCode => 409;
}

/// <summary>Authentication failed (401).</summary>
public sealed class AuthenticationFailedException(string message) : GymException(message)
{
    public override int StatusCode => 401;
}

/// <summary>Authenticated but not allowed (403).</summary>
public sealed class ForbiddenException(string message) : GymException(message)
{
    public override int StatusCode => 403;
}

/// <summary>Too many attempts (429).</summary>
public sealed class TooManyRequestsException(string message, int retryAfterSeconds)
    : GymException(message, null, new { retryAfterSeconds })
{
    public int RetryAfterSeconds { get; } = retryAfterSeconds;

    public override int StatusCode => 429;
}

/// <summary>Upload type is not allowed or its contents do not match (415).</summary>
public sealed class UnsupportedMediaException(string message)
    : GymException(message, [new FieldError("file", message)])
{
    public override int StatusCode => 415;
}

/// <summary>Upload is larger than allowed (413).</summary>
public sealed class PayloadTooLargeException(string message)
    : GymException(message, [new FieldError("file", message)])
{
    public override int StatusCode => 413;
}
