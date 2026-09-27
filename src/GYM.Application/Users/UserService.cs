using GYM.Application.Common;
using GYM.Domain.Exceptions;
using GYM.Domain.Rules;

namespace GYM.Application.Users;

public sealed class UserService(IUserRepository users, ICurrentUser currentUser, IUnitOfWork unitOfWork)
{
    public async Task<UserDto> GetMeAsync(CancellationToken ct = default)
    {
        var user = await users.GetAsync(currentUser.RequireUserId(), ct)
            ?? throw new AuthenticationFailedException("Your session has expired. Sign in again.");
        return user.ToDto();
    }

    public async Task<UserDto> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct = default)
    {
        var error = ValidationRules.DisplayName(request.DisplayName);
        if (error is not null)
        {
            throw new ValidationException("displayName", error);
        }

        var user = await users.GetAsync(currentUser.RequireUserId(), ct)
            ?? throw new AuthenticationFailedException("Your session has expired. Sign in again.");
        user.DisplayName = request.DisplayName!.Trim();
        await unitOfWork.SaveChangesAsync(ct);
        return user.ToDto();
    }
}
